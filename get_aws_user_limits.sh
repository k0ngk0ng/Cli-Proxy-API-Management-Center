#!/bin/bash

# AWS Kiro Usage Limits Query Script
# Usage: ./get_aws_user_limits.sh [REGION] [BEARER_TOKEN] [SERVICE]

# Default values
DEFAULT_REGION="us-east-1"
DEFAULT_SERVICE="q"

# Get parameters or use defaults
REGION="${1:-$DEFAULT_REGION}"
BEARER_TOKEN="${2}"
SERVICE="${3:-$DEFAULT_SERVICE}"

# Check if token is provided
if [ -z "$BEARER_TOKEN" ]; then
    echo "Error: Bearer token is required"
    echo "Usage: $0 [REGION] [BEARER_TOKEN] [SERVICE]"
    echo "Example: $0 us-east-2 your-bearer-token-here kendra"
    exit 1
fi

# Construct the API URL based on service
case $SERVICE in
    kendra)
        API_URL="https://kendra.${REGION}.amazonaws.com/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST"
        ;;
    q)
        API_URL="https://q.${REGION}.amazonaws.com/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST"
        ;;
    *)
        API_URL="https://${SERVICE}.${REGION}.amazonaws.com/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST"
        ;;
esac

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "AWS Kiro/Service Usage Limits Query"
echo "=========================================="
echo "Region: $REGION"
echo "Service: $SERVICE"
echo "API URL: $API_URL"
echo "=========================================="

# Make the API request using curl with Bearer authentication
echo -e "\n${YELLOW}Sending request to AWS...${NC}\n"

# Generate UUID for amz-sdk-invocation-id
UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Set up headers similar to kiro.rs implementation
USER_AGENT="aws-sdk-js/1.0.0 ua/2.1 os/darwin lang/js md/nodejs api/codewhispererruntime#1.0.0 m/N,E"
AMZ_USER_AGENT="aws-sdk-js/1.0.0"

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "User-Agent: ${USER_AGENT}" \
    -H "x-amz-user-agent: ${AMZ_USER_AGENT}" \
    -H "host: ${SERVICE}.${REGION}.amazonaws.com" \
    -H "amz-sdk-invocation-id: ${UUID}" \
    -H "amz-sdk-request: attempt=1; max=1" \
    -H "Connection: close" \
    --connect-timeout 30 \
    --max-time 60 \
    "${API_URL}" 2>&1)

CURL_EXIT_CODE=$?

# Extract HTTP status code (last line)
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n1)

# Extract response body (everything except last line)
RESPONSE_BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

# Check if curl command failed
if [ $CURL_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}✗ curl command failed with exit code: $CURL_EXIT_CODE${NC}"
    echo "Error details:"
    case $CURL_EXIT_CODE in
        6) echo "  - Could not resolve host (DNS failure)" ;;
        7) echo "  - Failed to connect to host" ;;
        28) echo "  - Operation timeout" ;;
        35) echo "  - SSL connection error" ;;
        *) echo "  - See curl error code $CURL_EXIT_CODE documentation" ;;
    esac
    echo "$RESPONSE_BODY"
    exit $CURL_EXIT_CODE
fi

echo "=========================================="
echo "Response Status: $HTTP_STATUS"
echo "=========================================="

# Check HTTP status code
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ Successfully retrieved user limits${NC}\n"
    echo "Response Body:"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
elif [ "$HTTP_STATUS" -eq 401 ]; then
    echo -e "${RED}✗ Authentication failed (401 Unauthorized)${NC}"
    echo "Please check your Bearer token"
elif [ "$HTTP_STATUS" -eq 403 ]; then
    echo -e "${RED}✗ Access forbidden (403 Forbidden)${NC}"
    echo "Please check your permissions"
elif [ "$HTTP_STATUS" -eq 404 ]; then
    echo -e "${RED}✗ Endpoint not found (404)${NC}"
    echo "Please verify the region and API endpoint"
else
    echo -e "${RED}✗ Request failed with status code: $HTTP_STATUS${NC}"
    echo "Response Body:"
    echo "$RESPONSE_BODY"
fi

echo -e "\n=========================================="
echo "Query completed"
echo "=========================================="
