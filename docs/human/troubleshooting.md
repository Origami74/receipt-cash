# Troubleshooting Guide

## Common Issues

### Price Fetching Fails with `ERR_BLOCKED_BY_CLIENT`

**Symptom**: BTC price fails to load with error `net::ERR_BLOCKED_BY_CLIENT` in the browser console, specifically for certain currencies like PYG.

**Cause**: Browser extensions (ad blockers, privacy tools) may block requests to the Coinbase API or specific URL patterns.

**Solution**:
1. Disable ad blockers or privacy extensions for your domain
2. Try a different browser without extensions
3. Check if the issue is currency-specific (some blockers may have rules matching certain currency codes)
4. The app will fall back to CoinGecko API, but not all currencies are supported there

**Note**: This typically only affects deployed/production domains, not localhost development.