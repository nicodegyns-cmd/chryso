#!/bin/bash

# Production deployment script for validation tracking feature
# Target: ubuntu@51.210.43.53

set -e

SERVER_IP="51.210.43.53"
SERVER_USER="ubuntu"
APP_DIR="/home/ubuntu/chryso"
LOG_FILE="/tmp/deployment.log"

echo "🚀 Starting deployment to $SERVER_IP..." | tee $LOG_FILE

# 1. Pull latest changes from GitHub
echo -e "\n📥 Pulling latest code from GitHub..." | tee -a $LOG_FILE
ssh ${SERVER_USER}@${SERVER_IP} "cd ${APP_DIR} && git pull origin main" | tee -a $LOG_FILE

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!" | tee -a $LOG_FILE
    exit 1
fi

# 2. Apply database migration
echo -e "\n🗄️  Applying database migration..." | tee -a $LOG_FILE
MIGRATION_TOKEN=$(ssh ${SERVER_USER}@${SERVER_IP} "echo \$ADMIN_MIGRATION_TOKEN" || echo "")

if [ -z "$MIGRATION_TOKEN" ]; then
    echo "⚠️  ADMIN_MIGRATION_TOKEN not set, applying SQL directly..." | tee -a $LOG_FILE
    ssh ${SERVER_USER}@${SERVER_IP} "cd ${APP_DIR} && psql \"\$DATABASE_URL\" -f sql/021_add_validation_columns_to_prestations.sql" | tee -a $LOG_FILE
else
    echo "Using migration token from environment..." | tee -a $LOG_FILE
    DOMAIN=$(ssh ${SERVER_USER}@${SERVER_IP} "grep -E 'NEXT_PUBLIC_API_URL|VERCEL_URL' ${APP_DIR}/.env | head -1 | cut -d= -f2 || echo 'localhost:3000'")
    curl -X POST "http://${DOMAIN}/api/admin/migrations/apply-021?token=${MIGRATION_TOKEN}" | tee -a $LOG_FILE
fi

# 3. Restart PM2
echo -e "\n🔄 Restarting PM2 application..." | tee -a $LOG_FILE
ssh ${SERVER_USER}@${SERVER_IP} "cd ${APP_DIR} && pm2 restart chryso || pm2 start npm --name chryso -- run start" | tee -a $LOG_FILE

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!" | tee -a $LOG_FILE
    exit 1
fi

# 4. Wait for app to be ready
echo -e "\n⏳ Waiting for application to be ready..." | tee -a $LOG_FILE
sleep 5

# 5. Verify deployment
echo -e "\n✅ Checking API health..." | tee -a $LOG_FILE
DOMAIN=$(ssh ${SERVER_USER}@${SERVER_IP} "grep -E 'NEXT_PUBLIC_API_URL|VERCEL_URL|APP_URL' ${APP_DIR}/.env | head -1 | cut -d= -f2 || echo 'localhost:3000'")
curl -s "http://${DOMAIN}/api/admin/prestations?limit=1" > /dev/null

if [ $? -eq 0 ]; then
    echo -e "\n🎉 Deployment completed successfully!" | tee -a $LOG_FILE
    echo "✅ Feature to track validation is now live!" | tee -a $LOG_FILE
else
    echo "⚠️  API check failed, but migration may still have applied" | tee -a $LOG_FILE
fi

# 6. Check logs
echo -e "\n📋 Recent application logs:" | tee -a $LOG_FILE
ssh ${SERVER_USER}@${SERVER_IP} "pm2 logs chryso --lines 20 --nostream" | tee -a $LOG_FILE

echo -e "\n📝 Full deployment log saved to: $LOG_FILE"
