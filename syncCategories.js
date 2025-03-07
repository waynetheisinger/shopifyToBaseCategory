require('dotenv').config();
const axios = require('axios');

// Load environment variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BASELINKER_API_KEY = process.env.BASELINKER_API_KEY;
const BASELINKER_INVENTORY_ID = process.env.BASELINKER_INVENTORY_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';

const SHOPIFY_QUERY = `
{
    products(first: 1) {
        edges {
            node {
                category {
                    ancestorIds
                    fullName
                    id
                    isArchived
                    isLeaf
                    isRoot
                    level
                    name
                    childrenIds
                    parentId
                }
                productCategory {
                    productTaxonomyNode {
                        fullName
                        name
                        isLeaf
                        isRoot
                    }
                }
            }
        }
        pageInfo {
            hasNextPage
            endCursor
        }
    }
}
`;

async function getShopifyCategories() {
    try {
        const response = await axios({
            url: `https://${SHOPIFY_STORE}/admin/api/2023-10/graphql.json`,
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
            data: {
                query: SHOPIFY_QUERY,
            },
        });

        return response.data.data.products.edges;
    } catch (error) {
        console.error('Error fetching Shopify categories:', error);
    }
}

async function fetchShopifyCategories() {
  let categories = new Set();
    let hasNextPage = true;
    let endCursor = null;

    while (hasNextPage) {
      try {
            const query = `
            {
                products(first: 250, after: ${endCursor ? `"${endCursor}"` : "null"}) {
                    edges {
                        node {
                            category {
                                ancestorIds
                                fullName
                                id
                                isArchived
                                isLeaf
                                isRoot
                                level
                                name
                                childrenIds
                                parentId
                            }
                            productCategory {
                                productTaxonomyNode {
                                    fullName
                                    name
                                    isLeaf
                                    isRoot
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
                        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                        'Content-Type': 'application/json',
                    },
                }
            );
            const data = response.data.data.products;
            if (!data) break;

            // Extract categories
            data.edges.forEach(({ node }) => {
                if (node.category) {
                    categories.add(node.category.fullName);
                }
            });

            // Update pagination variables
            hasNextPage = data.pageInfo.hasNextPage;
            endCursor = data.pageInfo.endCursor;
      } catch (error) {
        console.error('Error fetching Shopify categories:', error);
      }
    }
    return Array.from(categories);
}

function buildCategoryTree(categoryPaths) {
  let categoryTree = {};

  categoryPaths.forEach(path => {
      let levels = path.split(" > ");
      let parent = null;

      levels.forEach((level, index) => {
          if (!categoryTree[level]) {
              categoryTree[level] = { name: level, parent: parent, children: [] };
              if (parent) categoryTree[parent].children.push(level);
          }
          parent = level;
      });
  });

  return categoryTree;
}

async function fetchBaselinkerCategories() {
  try {
      const response = await axios.post('https://api.baselinker.com/connector.php', new URLSearchParams({
          method: 'getInventoryCategories',
          inventory_id: BASELINKER_INVENTORY_ID
      }), {
          headers: { "X-BLToken": BASELINKER_API_KEY }
      });

      return response.data.categories || {};
  } catch (error) {
      console.error("Error fetching Baselinker categories:", error.response?.data || error.message);
      return {};
  }
}

// Add Category to Baselinker
async function addBaselinkerCategory(categoryName, parentId = 0) {
  try {
      const response = await axios.post('https://api.baselinker.com/connector.php', new URLSearchParams({
          method: 'addInventoryCategory',
          inventory_id: BASELINKER_INVENTORY_ID,
          parent_id: parentId,
          name: categoryName
      }), {
          headers: { "X-BLToken": BASELINKER_API_KEY }
      });

      return response.data.category_id;
  } catch (error) {
      console.error(`Error adding Baselinker category (${categoryName}):`, error.response?.data || error.message);
      return null;
  }
}

async function syncCategories() {
  console.log("Fetching Shopify categories...");
  const shopifyCategories = await fetchShopifyCategories();
  
  console.log("Building category tree...");
  const categoryTree = buildCategoryTree(shopifyCategories);

  console.log("Fetching Baselinker categories...");
  const baselinkerCategories = await fetchBaselinkerCategories();

  let baselinkerCategoryLookup = {};
  Object.values(baselinkerCategories).forEach(category => {
      baselinkerCategoryLookup[category.name] = category.category_id;
  });

  console.log("Comparing categories...");
  for (const categoryName in categoryTree) {
      let categoryData = categoryTree[categoryName];
      let parentId = categoryData.parent ? baselinkerCategoryLookup[categoryData.parent] || 0 : 0;

      if (DRY_RUN) {
        console.log(`[Dry Run] Would add category: "${categoryName}" (Parent: ${categoryData.parent || "Root"})`);
      } else {
      if (!baselinkerCategoryLookup[categoryName]) {
        console.log(`Adding category: ${categoryName} (Parent: ${categoryData.parent || "Root"})`);
        const newCategoryId = await addBaselinkerCategory(categoryName, parentId);
        if (newCategoryId) {
            baselinkerCategoryLookup[categoryName] = newCategoryId;
        }
      }
    }
  }

  console.log("Sync complete.");
}

syncCategories()
    .then(() => console.log("Sync process finished."))
    .catch(err => console.error("Error in syncCategories:", err));
