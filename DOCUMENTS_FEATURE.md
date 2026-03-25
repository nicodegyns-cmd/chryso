# Documents Feature

## Overview

The Documents feature allows users to view and download documents that have been generated for their account. This includes PDFs, invoices, reports, and other files.

## Current Status

✅ **Frontend**: User interface implemented
- New "Mes documents" tab in user sidebar
- Documents list page at `/documents`
- Ready to display documents when they're generated

⏳ **Backend**: Ready for document generation
- API endpoint: `/api/documents` - fetch user documents
- Database table: `documents` - stores document metadata
- Ready to be populated when documents are generated

## How It Works

### For Users
1. Click "Mes documents" in the sidebar
2. View all documents generated for their account
3. Download documents as needed

### For Administrators (Future)
When you implement document generation, you'll:
1. Generate the document file (PDF, etc.)
2. Store it on the server or cloud storage
3. Insert a record in the `documents` table
4. User will see it automatically

## Database Schema

```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,           -- Link to user
  name VARCHAR(255) NOT NULL,         -- Display name
  type VARCHAR(50) DEFAULT 'PDF',     -- File type
  url TEXT,                           -- Download URL
  file_path VARCHAR(512),             -- Local storage path
  file_size BIGINT,                   -- Size in bytes
  description TEXT,                   -- Optional description
  is_public SMALLINT DEFAULT 0,       -- Public/private
  created_at TIMESTAMP,               -- Creation date
  updated_at TIMESTAMP                -- Last update
);
```

## API Endpoint

### GET `/api/documents`

**Parameters:**
- `email` (required) - User email address

**Response:**
```json
{
  "documents": [
    {
      "id": 1,
      "user_id": 42,
      "name": "Invoice_2026-03.pdf",
      "type": "PDF",
      "url": "https://example.com/docs/invoice_2026_03.pdf",
      "created_at": "2026-03-25T10:30:00Z"
    }
  ]
}
```

## Next Steps

To add document generation:

1. **Implement document generation logic**
   - Create API endpoint to generate documents (e.g., `/api/documents/generate`)
   - Use a library like `pdfkit` for PDF generation
   - Save file to storage

2. **Insert into documents table**
   ```javascript
   await query(
     `INSERT INTO documents (user_id, name, type, url, file_size, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
     [userId, 'Document_Name.pdf', 'PDF', downloadUrl, fileSize]
   )
   ```

3. **Users will see it immediately**
   - No frontend changes needed
   - The existing `/documents` page will display it

## Files Involved

- **Frontend**:
  - `pages/documents.jsx` - Document list page
  - `components/UserSidebar.jsx` - Navigation link

- **Backend**:
  - `pages/api/documents.js` - Fetch documents endpoint
  - `sql/014_create_documents_table.sql` - Database table

- **Migration**:
  - Run migration 014 to create the documents table when ready
