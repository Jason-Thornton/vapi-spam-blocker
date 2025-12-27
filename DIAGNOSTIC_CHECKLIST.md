# 🔍 Diagnostic Checklist - SpamStopper Issues

## Issue 1: CSS Not Showing ✅ FIXED
**Status:** Should be fixed after latest deploy
**What was wrong:** Tailwind CSS v4 incompatibility
**What was fixed:** Downgraded to Tailwind v3

**Verify:**
- Go to your app URL
- Page should have green/emerald styling
- If still broken, check Render logs for build errors

---

## Issue 2: Stripe Not Upgrading Users ✅ FIXED
**Status:** Should be fixed after latest deploy
**What was wrong:** Price IDs didn't match actual Stripe IDs
**What was fixed:** Updated webhook to check against real Price IDs

**Verify:**
1. Try upgrading to Basic plan ($1.99)
2. Complete Stripe checkout
3. Check Render logs for: `📊 Price ID received: price_1ShVJw4B9Z0lrxzSA6s0oSSY`
4. Should see: `📊 Upgrading user: [your-id] to tier: basic`
5. Refresh app - should show "Basic" plan

**If still not working:**
- Check Render environment variables include:
  - `STRIPE_PRICE_BASIC=price_1ShVJw4B9Z0lrxzSA6s0oSSY`
  - `STRIPE_PRICE_PRO=price_1ShVKa4B9Z0lrxzSUJ9GAJ2e`
  - `STRIPE_PRICE_UNLIMITED=price_1ShVLV4B9Z0lrxzShnjg62aP`
  - `STRIPE_WEBHOOK_SECRET=whsec_pAlxqL1Pyy8dIPdl0GY7k0cxyCFI9Pbk`

---

## Issue 3: Calls Not Being Saved ⚠️ NEEDS YOUR ACTION
**Status:** Requires manual configuration
**What's wrong:** One of these things is not configured:
1. Your phone number isn't registered in the app
2. Vapi webhook URL isn't set
3. Call recording isn't enabled in Vapi

### ✅ Checklist:

#### A. Register Your Phone Number
- [ ] Log in to app at your Netlify URL
- [ ] Click Settings (gear icon)
- [ ] Enter phone number: `+16184224956` (YOUR actual number with +1 prefix)
- [ ] Click Save
- [ ] Verify it shows: ✓ Registered: +16184224956

#### B. Verify Phone Number in Database
Test this URL in your browser:
```
https://your-render-app.onrender.com/api/debug/user/+16184224956
```
(Replace with YOUR actual phone number)

**Expected response:**
```json
{
  "success": true,
  "user": {
    "phone_number": "+16184224956",
    "email": "your-email@example.com",
    ...
  }
}
```

**If you see "User not found":**
- Phone number not saved correctly
- Go back to app Settings and save it again
- Make sure format is EXACTLY: `+1` + area code + number (no spaces/dashes)

#### C. Configure Vapi Webhook
- [ ] Go to https://dashboard.vapi.ai
- [ ] Click Settings → Webhooks
- [ ] Set Server URL to: `https://your-render-app.onrender.com/api/vapi-webhook`
- [ ] Click Save

#### D. Enable Call Recording in Vapi
For EACH assistant (Herbert, Jolene, Derek, Danny):
- [ ] Go to https://dashboard.vapi.ai → Assistants
- [ ] Click on assistant name
- [ ] Find "Recording" or "Call Recording" settings
- [ ] Enable "Record calls"
- [ ] Save

#### E. Test End-to-End
1. Forward your phone: `*72` + `618-352-8320` (Herbert's number)
2. From another phone, call your number with **blocked caller ID**
3. Let Herbert answer and talk for 15+ seconds
4. Hang up
5. Wait 1 minute
6. Check Render logs:
   ```
   ========== 📞 VAPI WEBHOOK RECEIVED ==========
   Event type: end-of-call-report
   ✅ Found user: your-email@example.com
   ✅ Call logged successfully
   ✅ Call count updated: 1 / 5
   ```
7. Refresh your app dashboard
8. Call should appear in call history

#### F. Common Issues

**If you see in Render logs:**
```
❌ USER NOT FOUND!
📋 Searched for phone_number: +16183528320
```
→ **Problem:** You're being looked up by the Vapi number, not your cell
→ **Cause:** Your carrier isn't sending the SIP Diversion header
→ **Solution:** Manually update the code to map Vapi number to your number

**If no webhook received at all:**
→ **Problem:** Vapi webhook URL not configured
→ **Solution:** Do step C above

**If recording_url is null:**
→ **Problem:** Call recording not enabled in Vapi
→ **Solution:** Do step D above

**If call appears but no recording:**
→ **Problem:** Vapi may take 1-2 minutes to process recording
→ **Solution:** Wait and refresh

---

## Quick Test Commands

### Test Backend is Running
```bash
curl https://your-render-app.onrender.com/api/test
```
Should return: `{"status":"Server is running!","vapiConnected":true}`

### Check User Registration
```bash
curl https://your-render-app.onrender.com/api/debug/user/+16184224956
```
Replace `+16184224956` with YOUR phone number

### View Recent Render Logs
1. Go to https://dashboard.render.com
2. Click your service
3. Click "Logs" tab
4. Look for webhook events and errors

---

## Summary

**Fixed automatically:**
✅ CSS/Styling (Tailwind v3)
✅ Stripe price ID matching

**Needs your action:**
⚠️ Register phone number in app Settings
⚠️ Set Vapi webhook URL
⚠️ Enable call recording in Vapi

Once you do these 3 things, everything should work!
