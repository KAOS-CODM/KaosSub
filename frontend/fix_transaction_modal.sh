#!/bin/bash
# Fix all transaction modal onclick handlers
sed -i 's/escapeTransaction(transaction)/JSON.stringify(transaction).replace(\/\"\/g, \"\\\\\"\")/g' history.html
sed -i 's/escapeTransaction(order)/JSON.stringify(order).replace(\/\"\/g, \"\\\\\"\")/g' history.html
sed -i 's/replace(\/\"\/g, '\''\"'\'')/replace(\/\"\/g, '\''\\\\\"'\'')/g' history.html

# Remove the escapeTransaction function
sed -i '/function escapeTransaction/,/^    }$/d' history.html
