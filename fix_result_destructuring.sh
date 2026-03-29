#!/bin/bash

# Remplacer le pattern "Array.isArray(q) ? q : (q && q.rows) ? q.rows : []"
# par "(q && q.rows) ? q.rows : Array.isArray(q) ? q[0] : []"
# pour vérifier .rows en premier

find /home/ubuntu/chryso/pages/api -name "*.js" -type f | while read file; do
  if grep -q "Array.isArray(q)" "$file"; then
    echo "Fixing: $file"
    # Using sed to replace the pattern
    sed -i 's/Array\.isArray(q) ? q : (q && q\.rows) ? q\.rows : \[\]/\(q \&\& q\.rows\) ? q\.rows : Array\.isArray(q) ? q[0] : []/g' "$file"
  fi
done

echo "Done!"
