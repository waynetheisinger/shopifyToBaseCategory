## **Shopify to Baselinker Category Sync**  

This Node.js script **synchronizes product categories** from **Shopify** to **Baselinker**.  
It ensures that Baselinker only contains **categories where products exist** in Shopify.  

### **Features**
✔ Fetches **all products' categories** from Shopify (handles pagination).  
✔ Maintains **category hierarchy** when adding to Baselinker.  
✔ **Dry-run mode** for previewing changes before applying them.  
✔ Runs **periodically via cron** for automatic updates.  

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

### **4. Run the Script**
#### **Preview Changes (Dry Run)**
```sh
node syncCategories.js
```
This **won't modify Baselinker** but will show what would be added.

#### **Apply Changes (Sync to Baselinker)**
```sh
DRY_RUN=false node syncCategories.js
```

---

## **How It Works**
1. **Fetches all Shopify product categories** (with pagination).  
2. **Extracts unique category paths** from the `category.fullName`.  
3. **Builds a parent-child category structure** to preserve hierarchy.  
4. **Fetches existing Baselinker categories** to avoid duplicates.  
5. **Adds only missing categories** to Baselinker (no deletions).  

---

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

