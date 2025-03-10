require('dotenv').config();
const axios = require('axios');

// Load environment variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BASELINKER_API_KEY = process.env.BASELINKER_API_KEY;
const BASELINKER_INVENTORY_ID = process.env.BASELINKER_INVENTORY_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';

async function fetchShopifyProducts() {
  let products = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
      try {
          const query = `
          {
              products(first: 250, after: ${endCursor ? `"${endCursor}"` : "null"}) {
                  edges {
                      node {
                          id
                          title
                          category {
                              name
                          }
                          variants(first: 1) {
                              edges {
                                  node {
                                      sku
                                  }
                              }
                          }
                      }
                  }
                  pageInfo {
                      hasNextPage
                      endCursor
                  }
              }
          }`;

          const response = await axios.post(
              `https://${SHOPIFY_STORE}/admin/api/2023-10/graphql.json`,
              { query },
              {
                  headers: {
                      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                      "Content-Type": "application/json"
                  }
              }
          );

          const data = response.data.data.products;
          if (!data) break;

          // Extract product details
          data.edges.forEach(({ node }) => {
              products.push({
                  id: node.id,
                  title: node.title,
                  sku: node.variants.edges.length > 0 ? node.variants.edges[0].node.sku : null,
                  category: node.category ? node.category.name : null
              });
          });

          hasNextPage = data.pageInfo.hasNextPage;
          endCursor = data.pageInfo.endCursor;
      } catch (error) {
          console.error("Error fetching Shopify products:", error.response?.data || error.message);
          break;
      }
  }

  return products;
}


async function fetchBaselinkerProductIDs() {
  try {
      const params = new URLSearchParams();
      params.append("method", "getInventoryProductsList");
      params.append("parameters", JSON.stringify({ inventory_id: BASELINKER_INVENTORY_ID }));

      const response = await axios.post("https://api.baselinker.com/connector.php", params, {
          headers: {
              "X-BLToken": BASELINKER_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded"
          }
      });

      if (response.data.status === "ERROR") {
          console.error(`Baselinker API Error: ${response.data.error_code} - ${response.data.error_message}`);
          return [];
      }

      return Object.keys(response.data.products).map(id => Number(id)); // Convert to array of product IDs
  } catch (error) {
      console.error("Error fetching Baselinker product IDs:", error.response?.data || error.message);
      return [];
  }
}

async function fetchBaselinkerProducts(productIDs) {
  const batchSize = 50; // Baselinker API might have limits, so fetch in batches
  let allProducts = {};

  for (let i = 0; i < productIDs.length; i += batchSize) {
      const batch = productIDs.slice(i, i + batchSize);

      try {
          const params = new URLSearchParams();
          params.append("method", "getInventoryProductsData");
          params.append("parameters", JSON.stringify({inventory_id: BASELINKER_INVENTORY_ID, products: batch }));

          const response = await axios.post("https://api.baselinker.com/connector.php", params, {
              headers: {
                  "X-BLToken": BASELINKER_API_KEY,
                  "Content-Type": "application/x-www-form-urlencoded"
              }
          });

          if (response.data.status === "ERROR") {
              console.error(`Baselinker API Error: ${response.data.error_code} - ${response.data.error_message}`);
              continue;
          }

          Object.assign(allProducts, response.data.products); // Merge batches into final product list
      } catch (error) {
          console.error("Error fetching Baselinker product details:", error.response?.data || error.message);
      }
  }

  return allProducts;
}

async function fetchBaselinkerCategories() {
  try {
      const params = new URLSearchParams();
      params.append("method", "getInventoryCategories");
      params.append("parameters", JSON.stringify({ inventory_id: BASELINKER_INVENTORY_ID }));

      const response = await axios.post("https://api.baselinker.com/connector.php", params, {
          headers: { 
              "X-BLToken": BASELINKER_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded" // 🔹 Ensure correct format
          }
      });

      // Check if Baselinker returned an error inside response.data
      if (response.data.status === "ERROR") {
          console.error(`Baselinker API Error: ${response.data.error_code} - ${response.data.error_message}`);
          return null;
      }

      return response.data.categories || {};
  } catch (error) {
      console.error("Error fetching Baselinker categories:", error.response?.data || error.message);
      return {};
  }
}

function mapShopifyToBaselinker(shopifyProducts, baselinkerProducts) {
  let productMap = {};

  for (const shopifyProduct of shopifyProducts) {
      if (!shopifyProduct.sku) continue; // Skip if SKU is missing

      for (const baselinkerProductId in baselinkerProducts) {
          const baselinkerProduct = baselinkerProducts[baselinkerProductId];

          if (baselinkerProduct.sku === shopifyProduct.sku) {
              productMap[shopifyProduct.sku] = {
                  shopify: shopifyProduct,
                  baselinker: baselinkerProduct
              };
              break;
          }
      }
  }

  return productMap;
}

function mapShopifyToBaselinker(shopifyProducts, baselinkerProducts) {
  let productMap = {};

  for (const shopifyProduct of shopifyProducts) {
      if (!shopifyProduct.sku) continue; // Skip if SKU is missing

      for (const baselinkerProductId in baselinkerProducts) {
          const baselinkerProduct = baselinkerProducts[baselinkerProductId];

          if (baselinkerProduct.sku === shopifyProduct.sku) {
              productMap[shopifyProduct.sku] = {
                  shopify: shopifyProduct,
                  baselinker: baselinkerProduct,
                  current_category: baselinkerProduct.category_id || null // Now includes the category
              };
              break;
          }
      }
  }

  return productMap;
}

async function updateBaselinkerProductCategory(productId, categoryId) {
  try {
      const params = new URLSearchParams();
      params.append("method", "addInventoryProduct");
      params.append("parameters", JSON.stringify({
          inventory_id: BASELINKER_INVENTORY_ID,
          product_id: productId, // Ensures it only updates existing products
          category_id: categoryId // Updating category only
      }));

      const response = await axios.post("https://api.baselinker.com/connector.php", params, {
          headers: {
              "X-BLToken": BASELINKER_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded"
          }
      });

      if (response.data.status === "ERROR") {
          console.error(`Baselinker API Error: ${response.data.error_code} - ${response.data.error_message}`);
          return false;
      }

      return true;
  } catch (error) {
      console.error(`Error updating Baselinker product category (Product ID: ${productId}):`, error.response?.data || error.message);
      return false;
  }
}

async function syncShopifyProductsToBaselinker() {
  console.log("Fetching Shopify products...");
  const shopifyProducts = await fetchShopifyProducts();

  console.log("Fetching Baselinker product IDs...");
  const baselinkerProductIDs = await fetchBaselinkerProductIDs();

  if (baselinkerProductIDs.length === 0) {
      console.error("❌ ERROR: No Baselinker products found. Aborting sync.");
      return;
  }

  console.log(`Fetching details for ${baselinkerProductIDs.length} Baselinker products...`);
  const baselinkerProducts = await fetchBaselinkerProducts(baselinkerProductIDs);

  console.log("Fetching Baselinker categories...");
  const baselinkerCategories = await fetchBaselinkerCategories();

  console.log("Mapping Shopify products to Baselinker...");
  const productMap = mapShopifyToBaselinker(shopifyProducts, baselinkerProducts);

  console.log(`Assigning categories... (Dry Run: ${DRY_RUN ? "Enabled" : "Disabled"})`);

  for (const sku in productMap) {
      const { shopify, baselinker } = productMap[sku];

      if (!shopify.category) continue; // Skip if no category

      // Skip products that don't exist in Baselinker
      if (!baselinker) {
          console.log(`❌ Skipping product "${shopify.title}" (SKU: ${sku}) as it does not exist in Baselinker.`);
          continue;
      }

      // Find Baselinker category ID
      const baselinkerCategoryId = Object.values(baselinkerCategories)
          .find(c => c.name === shopify.category)?.category_id;

      if (!baselinkerCategoryId) {
          console.error(`❌ ERROR: No matching Baselinker category for "${shopify.category}"`);
          continue;
      }

      // Only update if the category is different
      if (baselinker.category_id === baselinkerCategoryId) {
          console.log(`✅ No change needed for "${baselinker.text_fields.name}" (SKU: ${sku}), already in correct category.`);
          continue;
      }

      if (DRY_RUN) {
          console.log(`[Dry Run] Would update category for "${baselinker.text_fields.name}" (SKU: ${sku}) to "${shopify.category}" (Category ID: ${baselinkerCategoryId})`);
      } else {
          console.log(`Updating category for "${baselinker.text_fields.name}" (SKU: ${sku})`);
          await updateBaselinkerProductCategory(baselinker.id, baselinkerCategoryId);
      }
  }

  console.log(`✅ Sync complete. ${DRY_RUN ? "No changes were made (Dry Run Mode)." : "Products updated in Baselinker."}`);
}

syncShopifyProductsToBaselinker()
  .then(() => console.log("Sync process finished."))
  .catch(err => console.error("Error in syncShopifyProductsToBaselinker:", err));