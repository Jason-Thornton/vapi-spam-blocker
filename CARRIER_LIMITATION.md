# Carrier Limitation: Missing Diversion Header

## The Problem

Your current carrier (382com) does not send the SIP Diversion header when forwarding calls. This header contains the user's original cell phone number, which we need to identify which user account the call belongs to.

## Impact

**Without Diversion Header:**
- System cannot identify which user's cell phone forwarded the call
- Can only identify users by which Vapi number received the call
- **This means each user needs their own dedicated Vapi number**
- With 4 Vapi numbers, you can only support 4 users

**With Diversion Header:**
- System can identify users by their cell phone number
- **Multiple users can share the same Vapi number**
- With 4 Vapi numbers, you could support unlimited users

## Solutions

### Option 1: Change Carriers (Recommended)
Switch to a carrier that properly sends SIP Diversion headers:
- Twilio
- Vonage
- Bandwidth.com
- Telnyx

Most major VoIP carriers support this standard SIP header.

### Option 2: Buy More Vapi Numbers (Temporary)
- Each new user gets assigned their own Vapi number
- This is expensive and doesn't scale well
- Only works up to the number of Vapi numbers you have

### Option 3: PIN Code Authentication
- When call starts, agent asks user to enter a 4-digit PIN
- User enters PIN via phone keypad
- System looks up user by PIN + Vapi number combination
- Adds friction to user experience

### Option 4: Voice Biometrics
- Record user's voice during signup
- When call comes in, identify user by voice
- Requires additional AI/ML services
- More complex and expensive

## Recommendation

**Test with another carrier first!** Before implementing workarounds:

1. Sign up for a trial account with Twilio or Vonage
2. Configure one Vapi assistant to use their SIP service
3. Test if they send the Diversion header
4. If yes, switch carriers permanently

This is the cleanest solution and enables true multi-user support with your existing 4 Vapi numbers.

## Current Temporary Solution

The code now supports both scenarios:
1. If Diversion header exists → Look up user by phone_number
2. If no Diversion header → Look up user by assigned_vapi_number

You'll need to run this SQL to add the new column:
```sql
ALTER TABLE users ADD COLUMN assigned_vapi_number TEXT;
```

Then assign each user their own unique Vapi number in the database.
