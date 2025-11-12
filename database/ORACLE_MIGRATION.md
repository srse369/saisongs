# Oracle Autonomous Database Migration Guide

This guide explains how to migrate from Neon PostgreSQL to Oracle Autonomous Database.

## Prerequisites

1. Oracle Autonomous Database instance
2. Oracle Instant Client installed (for node-oracledb)
3. Wallet files downloaded from Oracle Cloud Console

## Installation Steps

### 1. Install Oracle Instant Client

**macOS:**
```bash
brew install instantclient-basic
```

**Linux:**
Download from Oracle website and follow installation instructions.

**Windows:**
Download from Oracle website and add to PATH.

### 2. Install Dependencies

```bash
npm install
```

This will install `oracledb` package (version 6.7.0 or later).

### 3. Configure Wallet (for Autonomous Database)

1. Download wallet from Oracle Cloud Console
2. Extract wallet files to a secure location
3. Set environment variable:
   ```bash
   export TNS_ADMIN=/path/to/wallet
   ```

### 4. Update Environment Variables

Copy `.env.local.template` to `.env.local` and update:

```env
VITE_ORACLE_USER=your_username
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_service_name_high
```

The connect string can be:
- Simple: `your_service_name_high` (if using wallet)
- Full: `(description=(retry_count=20)...)`

### 5. Run Schema Migration

Connect to your Oracle database using SQL Developer or SQLcl and run:

```bash
sqlplus username/password@connect_string @database/schema_oracle.sql
```

Or use SQL Developer to execute `database/schema_oracle.sql`.

## Key Differences from PostgreSQL

### Data Types
- `UUID` → `RAW(16)` with `SYS_GUID()`
- `TEXT` → `CLOB`
- `VARCHAR(n)` → `VARCHAR2(n)`
- `BOOLEAN` → `NUMBER(1)` (0 = false, 1 = true)

### SQL Syntax
- `gen_random_uuid()` → `SYS_GUID()`
- `DROP TABLE IF EXISTS` → PL/SQL block with exception handling
- `CURRENT_TIMESTAMP` works the same
- Parameter placeholders: `:1`, `:2` instead of `$1`, `$2`

### Connection
- Uses connection pooling with `oracledb.createPool()`
- Requires Oracle Instant Client
- Supports wallet-based authentication for Autonomous Database

## Testing Connection

After setup, test the connection:

```bash
npm run dev
```

Check browser console for "Oracle database connection pool established" message.

## Troubleshooting

### Error: DPI-1047: Cannot locate a 64-bit Oracle Client library
- Install Oracle Instant Client
- Set LD_LIBRARY_PATH (Linux) or DYLD_LIBRARY_PATH (macOS)

### Error: NJS-500: connection pool is closing
- Check if pool is being closed prematurely
- Ensure proper connection cleanup

### Error: ORA-12154: TNS:could not resolve the connect identifier
- Check TNS_ADMIN environment variable
- Verify wallet files are in correct location
- Check connect string format

## Performance Considerations

- Connection pooling is configured with min=1, max=10
- Auto-commit is enabled for better performance
- OUT_FORMAT_OBJECT for easier result handling
- Indexes are created on frequently queried columns

## Backup and Restore

### Export Data
```sql
expdp username/password@connect_string directory=DATA_PUMP_DIR dumpfile=songstudio.dmp schemas=your_schema
```

### Import Data
```sql
impdp username/password@connect_string directory=DATA_PUMP_DIR dumpfile=songstudio.dmp schemas=your_schema
```

## Support

For Oracle-specific issues, refer to:
- [node-oracledb Documentation](https://node-oracledb.readthedocs.io/)
- [Oracle Autonomous Database Documentation](https://docs.oracle.com/en/cloud/paas/autonomous-database/)
