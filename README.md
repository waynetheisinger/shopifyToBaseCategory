## **Shopify to Baselinker Category Sync**  

This Node.js script **synchronizes product categories** from **Shopify** to **Baselinker**.  
It ensures that Baselinker only contains **categories where products exist** in Shopify and ensures that Baselinker products are always assigned to the correct categories but does not create new products.

### **Features**
✔ Fetches all Shopify product categories and maintains category hierarchy in Baselinker.  
✔ Assigns the correct category to products in Baselinker based on Shopify data.  
✔ Only updates existing products in Baselinker (no new product creation).  
✔ Uses addInventoryProduct to update only the category.  
✔ Dry-run mode to preview changes before applying them.  
✔ Runs periodically via cron for automatic updates.  

---

## **Setup Instructions**

### **1. Clone the Repository**
```sh
git clone https://github.com/your-repo/shopify-to-baselinker-sync.git
cd shopify-to-baselinker-sync
```

### **2. Install Dependencies**
```sh
npm install
```

### **3. Configure Environment Variables**
Create a `.env` file in the project root:  

```ini
SHOPIFY_STORE=myshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token

BASELINKER_API_KEY=your_baselinker_api_key
BASELINKER_INVENTORY_ID=your_inventory_id

DRY_RUN=true  # Set to false to sync categories to Baselinker
```

### **4. Run the Scripts**
#### **Preview Changes (Dry Run)**
```sh
node syncCategories.js
node syncProductCategories.js
```
This **won't modify Baselinker** but will show what would be added.

#### **Apply Changes (Sync to Baselinker)**
```sh
DRY_RUN=false node syncCategories.js && syncProductCategories.js
```

---

## **How It Works**
1. **Fetches all Shopify product categories** (with pagination).  
2. **Extracts unique category paths** from the `category.fullName`.  
3. **Builds a parent-child category structure** to preserve hierarchy.  
4. **Fetches existing Baselinker categories** to avoid duplicates.  
5. **Adds only missing categories** to Baselinker (no deletions).  

---
## Product Category Sync
1. **Fetches all Shopify products** (including SKU & category).
2. **Retrieves Baselinker product IDs**, then fetches **detailed product data** in batches.
3. **Only updates products that already exist in Baselinker** (does not create new products).
4. Finds the correct Baselinker category for each product.
5. Uses addInventoryProduct to update the category for existing products.

## **Automate with Cron**
Run the script **daily at 2 AM**:  
```sh
crontab -e
```
Add this line:
```
0 2 * * * /usr/bin/node /path/to/shopify-to-baselinker/syncCategories.js >> /path/to/log.log 2>&1
```

---

## **Troubleshooting**
- **Script exits without output?**  
  - Check API credentials in `.env`.  
- **Too many API requests?**  
  - Shopify API is rate-limited. Try **reducing frequency** of execution.  
- **Baselinker categories not updating?**  
  - Ensure `DRY_RUN=false` before syncing.  

---

## **Future Enhancements**
- ✅ **Logging to file** for tracking changes.  
- ✅ **Interactive confirmation before sync**.  
- ⏳ **Support for multiple inventories** in Baselinker.  

---

## **License**
This project is licensed under the **Apache License 2.0**.  
See the [LICENSE](LICENSE) file for more details.  

---

## **Contributing**
Feel free to submit issues or pull requests. Contributions are welcome! 🚀  

