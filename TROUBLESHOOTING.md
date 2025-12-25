# Troubleshooting: Call Logs and Counter Not Updating

## Issue
After a spam call where Herbert answered and talked to the caller, the call logs don't show the call and the counter still shows 0/5.

## Root Cause Analysis

There are several possible reasons:

### 1. Webhook URL Not Configured in Vapi (MOST LIKELY)

**Problem:** Vapi doesn't know where to send the `end-of-call-report` event.

**How to Check:**
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Click **Settings** → **Webhooks**
3. Look for "Server URL" or "Webhook URL"

**How to Fix:**
1. Find your Render app URL:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click on your service
   - Copy the URL (e.g., `https://vapi-spam-blocker-abc123.onrender.com`)

2. In Vapi Dashboard:
   - Go to **Settings** → **Webhooks**
   - Set **Server URL** to: `https://your-render-app.onrender.com/api/vapi-webhook`
   - Make sure to include `/api/vapi-webhook` at the end!

3. Save and test

### 2. Code Not Deployed to Render

**Problem:** The webhook endpoint exists but the code hasn't been deployed.

**How to Check:**
```bash
# Check if there are unpushed commits
git status
```

**How to Fix:**
```bash
# If you see "Your branch is ahead of origin/main"
git push

# Then check Render deployment
# Go to https://dashboard.render.com
# Click your service → Events
# Wait for "Deploy live" status
```

**Status:** ✅ FIXED - Code was pushed and should be deploying now

### 3. Webhook Events Not Being Sent

**Problem:** Vapi isn't sending webhook events for some reason.

**How to Check:**
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai) → **Logs**
2. Find your recent call
3. Click on it to see details
4. Look for webhook events sent

**How to Fix:**
- Ensure webhook URL is configured (see #1)
- Check that the assistant has the server URL set
- Verify the call actually completed (wasn't dropped)

### 4. Webhook Receiving Events But Failing

**Problem:** Render is receiving events but something is failing in the code.

**How to Check Render Logs:**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click your service → **Logs**
3. Look for recent webhook calls
4. Search for:
   - `"📞 Vapi webhook received"` - Webhook was received
   - `"end-of-call-report"` - End of call event received
   - `"✅ Call logged successfully"` - Call was logged to database
   - `"✅ Call count updated"` - Counter was incremented
   - `"❌"` - Any errors

**Common Errors:**
- `"⚠️ User not found"` - Your phone number isn't registered
- `"Error logging call"` - Database permission issue
- `"Error updating call count"` - Database update failed

**How to Fix:**
- If user not found: Make sure your phone number is saved in app Settings
- If database errors: Check Supabase service role key in Render environment variables
- If no logs at all: Webhook URL is wrong (see #1)

### 5. User Phone Number Not Registered

**Problem:** Your cell number isn't saved in the database, so webhook can't find your user record.

**How to Check:**
1. Open your app
2. Go to Settings
3. Look at "Your Phone Number" field
4. Should show your number in E.164 format: `+16184224956`

**How to Fix:**
1. In app Settings, enter your phone number
2. Format: `+1` + area code + number (no spaces, dashes, or parentheses)
3. Example: `+16184224956` NOT `(618) 422-4956`
4. Click Save

### 6. Diversion Header Not Being Sent

**Problem:** Your carrier isn't sending the SIP Diversion header, so the webhook can't identify you.

**How to Check Render Logs:**
Look for:
```
🔍 DEBUG: Diversion header: <sip:+16184224956@...>
📞 Call forwarded from user cell: +16184224956
```

If you see:
```
⚠️ DEBUG: No Diversion header found
```

Then your carrier isn't sending it.

**How to Fix:**
Most US carriers (Verizon, AT&T, T-Mobile) send this header with call forwarding. If yours doesn't:

**Option A:** Update the code to use a mapping table
```javascript
// Map Vapi numbers to user phone numbers
const vapiToUserMap = {
  '+16183528320': '+16184224956'  // Herbert's number → Your number
};
```

**Option B:** Add a query parameter to the webhook URL (not recommended for security)

### 7. Call Was Transferred (After New Code)

**Problem:** If you configured the new spam detection, legitimate calls get transferred and shouldn't be logged.

**Expected Behavior:**
- Spam calls (Unknown caller ID): Logged and counted
- Legitimate calls (Known caller ID): Transferred, NOT logged/counted

**How to Check:**
- Did the caller have a normal caller ID?
- Did the call transfer to your phone?
- If yes, this is correct behavior - it shouldn't be logged

---

## Quick Diagnostic Steps

### Step 1: Verify Webhook URL

Run this command to test if your webhook is accessible:
```bash
curl https://your-render-app.onrender.com/api/test
```

Should return:
```json
{
  "status": "Server is running!",
  "vapiConnected": true
}
```

### Step 2: Check Your User Record

Visit this URL (replace with your phone number):
```
https://your-render-app.onrender.com/api/debug/user/+16184224956
```

Should return your user info and recent call logs.

If you see:
```json
{
  "success": false,
  "message": "User not found"
}
```

Then go to app Settings and save your phone number.

### Step 3: Make a Test Call

1. Forward your phone: `*72` + `618-352-8320` + `Call`
2. From another phone, call your number with blocked caller ID
3. Let Herbert answer and talk for 10+ seconds
4. Hang up
5. Wait 30 seconds
6. Refresh your app dashboard

### Step 4: Check Render Logs Immediately

1. Go to Render Dashboard → Logs
2. Look for the `end-of-call-report` event
3. Check if it shows:
   ```
   ✅ Call logged successfully
   ✅ Call count updated: 1 / 5
   ```

### Step 5: Check Vapi Logs

1. Go to Vapi Dashboard → Logs
2. Find your call
3. Click to expand details
4. Look for "Webhooks Sent" section
5. Should show:
   - `status-update` (ringing)
   - `status-update` (in-progress)
   - `end-of-call-report` (completed)

6. If `end-of-call-report` shows ✅ sent, but Render logs don't show it received:
   - Webhook URL is wrong
   - Check the exact URL in Vapi settings

---

## Most Likely Solutions

Based on the symptoms (call happened, but no log/counter), the issue is almost certainly **#1 or #5**:

### Fix #1: Configure Webhook URL in Vapi

1. Get your Render URL: `https://your-app.onrender.com`
2. Go to Vapi Dashboard → Settings → Webhooks
3. Set URL to: `https://your-app.onrender.com/api/vapi-webhook`
4. Save

### Fix #5: Register Your Phone Number

1. Open app → Settings
2. Enter your phone number: `+16184224956`
3. Click Save
4. Verify it shows in the field

---

## Testing After Fixes

Once you've applied the fixes:

1. **Test the debug endpoint:**
   ```
   https://your-app.onrender.com/api/debug/user/+16184224956
   ```
   Should show your user and call history.

2. **Make a test call:**
   - Forward your phone to Herbert's number
   - Call yourself from another phone
   - Let it ring and answer
   - Talk for 10 seconds
   - Hang up
   - Wait 30 seconds
   - Refresh app dashboard

3. **Check the results:**
   - Counter should show 1/5
   - Call log should appear
   - Recording should be available (if Vapi provides it)

---

## Still Not Working?

If you've tried everything above and it's still not working:

1. **Check Supabase:**
   - Go to Supabase Dashboard → Table Editor
   - Open `call_logs` table
   - See if any rows exist for your user_id
   - Open `users` table
   - Check if your `calls_used_this_month` incremented

2. **Check Environment Variables in Render:**
   - `VITE_SUPABASE_URL` - Should be your Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Should be your service role key (starts with `eyJ`)
   - `VAPI_API_KEY` - Your Vapi API key

3. **Enable Debug Mode:**
   - In Render Dashboard, add environment variable:
     ```
     DEBUG=true
     ```
   - Redeploy
   - Make a test call
   - Check logs for detailed output

4. **Contact Support:**
   - Vapi Support: Check if webhooks are being sent
   - Render Support: Check if webhooks are being received
   - Provide: Call timestamp, Vapi call ID, Render logs

---

## Prevention

To avoid this in the future:

1. **Set up monitoring:**
   - Use Render's log streaming
   - Set up Sentry or similar for error tracking
   - Create alerts for failed webhook calls

2. **Test after every change:**
   - Always test end-to-end after deploying
   - Verify logs, counters, and recordings
   - Keep test phone numbers handy

3. **Document your setup:**
   - Keep track of your Vapi phone numbers
   - Document which assistant uses which number
   - Note your webhook URLs and environment variables

---

## Quick Reference

**Your Setup:**
- App: Netlify (frontend) + Render (backend)
- Database: Supabase
- Voice: Vapi
- Auth: Clerk

**Critical URLs:**
- Webhook: `https://your-render-app.onrender.com/api/vapi-webhook`
- Debug: `https://your-render-app.onrender.com/api/debug/user/+YOURNUMBER`
- Test: `https://your-render-app.onrender.com/api/test`

**Vapi Phone Numbers:**
- Herbert (Free): +1(618)352-8320
- Jolene (Basic): +1(618)352-8316
- Derek (Basic): +1(815)426-4287
- Danny (Basic): +1(813)809-2181

**Call Forwarding:**
- Activate: `*72` + Vapi number + Call
- Deactivate: `*73` + Call

**Phone Number Format:**
- Correct: `+16184224956`
- Wrong: `(618) 422-4956`, `618-422-4956`, `6184224956`
