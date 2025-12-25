# Vapi Assistant Configuration Guide

## Overview
This guide will help you configure your Vapi AI assistants (Herbert, Jolene, Derek, Danny) to automatically detect spam calls and route legitimate calls back to your phone.

## Step 1: Add the Database Column

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS blocked_numbers TEXT[] DEFAULT ARRAY[]::TEXT[];
```

This allows users to maintain a custom block list.

## Step 2: Configure Each Vapi Assistant

You need to add TWO functions to each assistant in your Vapi dashboard:

### Function 1: checkSpamAndRoute (Primary Routing Function)

1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Navigate to **Assistants** → Select **Herbert** (repeat for all personas)
3. Scroll to **Functions** section
4. Click **Add Function**
5. Add this function:

**Function Name:** `checkSpamAndRoute`

**Description:** "Checks if the incoming caller is spam/unknown and determines whether to answer the call or transfer it to the user's phone."

**Server URL:** `https://your-render-app.onrender.com/api/vapi-webhook`

**JSON Schema:**
```json
{
  "name": "checkSpamAndRoute",
  "description": "Checks if the incoming caller is spam/unknown and determines whether to answer the call or transfer it to the user's phone.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### Function 2: transferCall (Built-in Transfer Tool)

1. In the same assistant, go to **Tools** section
2. Click **Add Tool** → Select **Transfer Call**
3. Configure as follows:

**Destinations:** Leave empty (dynamic routing)

**Transfer Message:** "One moment please, transferring your call..."

This creates a transfer tool that your assistant can use.

## Step 3: Update Assistant System Prompts

For each assistant (Herbert, Jolene, Derek, Danny), update their **System Prompt** to include this routing logic at the very beginning:

```
CRITICAL ROUTING INSTRUCTIONS (Execute immediately when call starts):

1. As soon as the call connects, BEFORE engaging with the caller, call the checkSpamAndRoute function.

2. Based on the response:
   - If isSpam = true and shouldTransfer = false:
     → This is a spam call. Proceed with your normal spam-wasting conversation.

   - If isSpam = false and shouldTransfer = true:
     → This is a legitimate caller. Say: "One moment please, let me connect you."
     → Use the transferCall tool to transfer the call to the number provided in transferTo field.
     → After initiating transfer, end your involvement.

3. NEVER engage in conversation with legitimate callers. Transfer them immediately.

[Rest of your existing persona instructions below...]
```

### Example for Herbert:

```
CRITICAL ROUTING INSTRUCTIONS (Execute immediately when call starts):

1. As soon as the call connects, BEFORE engaging with the caller, call the checkSpamAndRoute function.

2. Based on the response:
   - If isSpam = true and shouldTransfer = false:
     → This is a spam call. Proceed with your normal spam-wasting conversation.

   - If isSpam = false and shouldTransfer = true:
     → This is a legitimate caller. Say: "One moment please, let me connect you."
     → Use the transferCall tool to transfer the call to the number provided in transferTo field.
     → After initiating transfer, end your involvement.

3. NEVER engage in conversation with legitimate callers. Transfer them immediately.

---

PERSONA: Herbert (Confused Elderly Man)

You are Herbert, an 80-year-old retired accountant who is easily confused by technology and modern terms. You are hard of hearing and often misunderstand what the caller is saying.

PERSONALITY TRAITS:
- Frequently asks callers to repeat themselves
- Goes off on tangents about "the old days"
- Gets confused by technical terms
- Takes a long time to understand simple concepts
- Occasionally forgets what you're talking about mid-conversation
- Very polite but slow to process information

CONVERSATION STRATEGY:
- Act genuinely interested but perpetually confused
- Ask many clarifying questions
- Share irrelevant stories from your past
- Mishear words and interpret them incorrectly
- Take your time responding, as if thinking hard
- Never give real personal information, but invent plausible-sounding fake details

EXAMPLE BEHAVIORS:
- "Hold on, let me get my hearing aid... okay, what was that?"
- "In my day, we didn't have any of this fancy computer business"
- "My grandson tried to explain that to me once, but I still don't understand"
- "Wait, you want my what? My social security number? Why would you need that?"

Your goal is to waste as much of the spam caller's time as possible while staying in character.
```

## Step 4: How the Call Flow Works

```
Incoming Call to Vapi Number
         ↓
Assistant answers and immediately calls checkSpamAndRoute()
         ↓
Server checks:
  - Is caller ID Unknown/Unavailable?
  - Is caller in user's blocked list?
  - Is user registered with calls remaining?
         ↓
    ┌────┴────┐
    ↓         ↓
  SPAM      LEGIT
    ↓         ↓
Herbert    Transfer
engages     to User
caller       Phone
```

## Step 5: Testing

### Test Spam Call Flow:
1. Forward your phone to Herbert's number: `*72 618-352-8320`
2. Have someone call you from a number NOT in your contacts or block their caller ID
3. Expected: Herbert should answer and engage the "spam" caller

### Test Legitimate Call Flow:
1. Keep forwarding active: `*72 618-352-8320`
2. Have someone call you from a known number (in your contacts)
3. Expected: Assistant should say "One moment please" and transfer to your cell
4. Your phone should ring

### Test User Not Registered:
1. Forward from an unregistered number
2. Expected: Call transfers immediately (no AI engagement)

### Test Call Limit Exceeded:
1. Use all your monthly calls
2. Next call should transfer automatically

## Step 6: Update Your Vapi Webhook URL

Make sure your Render deployment has the correct webhook URL configured in Vapi:

**Webhook URL:** `https://your-render-app.onrender.com/api/vapi-webhook`

To find your Render app URL:
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your service
3. Copy the URL (e.g., `https://vapi-spam-blocker.onrender.com`)
4. In Vapi dashboard, go to **Settings** → **Webhooks**
5. Set webhook URL to: `https://your-app.onrender.com/api/vapi-webhook`

## Step 7: Deploy Your Changes

1. Commit and push your code changes:
```bash
git add .
git commit -m "Add spam detection and call routing functionality"
git push
```

2. Your Render app should auto-deploy (if connected to GitHub)
3. Verify deployment in Render dashboard

## Troubleshooting

### Calls Not Being Detected as Spam
- Check server logs in Render dashboard
- Look for "🔍 Checking spam status for caller" logs
- Verify caller ID is truly showing as "Unknown" or "Unavailable"

### Calls Not Transferring
- Ensure transferCall tool is configured in Vapi
- Check that assistant system prompt includes transfer instructions
- Verify webhook is receiving function calls (check logs)

### User Not Found Errors
- Ensure your cell number is registered in app Settings
- Format must be E.164: `+16184224956` (no spaces, dashes, or parentheses)
- Check Supabase users table to confirm phone_number is saved

### Debug Endpoint

Use this endpoint to check user status:
```
GET https://your-app.onrender.com/api/debug/user/+16184224956
```

Replace with your phone number to see:
- User registration status
- Current call count
- Recent call logs

## Important Notes

1. **Carrier Compatibility:** Your carrier must send the SIP Diversion header for proper user identification. Most US carriers support this with call forwarding.

2. **Caller ID Spoofing:** Some spam callers spoof legitimate-looking numbers. The current system only blocks Unknown/Unavailable caller IDs.

3. **Call Costs:** Each call (spam or transferred) counts toward Vapi usage. Monitor your Vapi billing.

4. **Transfer Limitations:** Phone-to-phone transfers are supported, but the call must originate and terminate on phone networks (no web clients).

5. **Monthly Reset:** Call counters reset monthly. You'll need to set up a cron job or manual process for this.

## Advanced: Adding Custom Block List

Users can manually add numbers to their block list:

```sql
UPDATE users
SET blocked_numbers = ARRAY['+15551234567', '+15559876543']
WHERE phone_number = '+16184224956';
```

Or add this functionality to your app's UI later.

---

## Support

If you encounter issues:
1. Check Render logs: `https://dashboard.render.com` → Your Service → Logs
2. Check Vapi logs: `https://dashboard.vapi.ai` → Logs
3. Check Supabase logs: `https://app.supabase.io` → Your Project → Logs

Make sure all three systems are properly connected and communicating.
