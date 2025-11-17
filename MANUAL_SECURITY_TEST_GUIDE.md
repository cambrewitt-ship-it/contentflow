## Test 1: Client Data Isolation

**Setup**
1. Open Chrome (User A) and navigate to the app URL.
2. Open Firefox or Chrome Incognito (User B) and navigate to the same app URL.
3. Create two accounts:
   - User A: `test-user-a@example.com`
   - User B: `test-user-b@example.com`

**Steps**
1. In the User A browser:
   - Create a client named “User A Client.”
   - Note the client ID from the URL (e.g., `/clients/abc-123-def`).
2. In the User B browser:
   - Create a client named “User B Client.”
   - Attempt to access User A’s client by:
     - Manually entering User A’s client ID into the URL.
     - Opening DevTools (`F12`) → Network tab and monitoring all requests.

**Expected Result**
- User B sees a 403 Forbidden or 404 Not Found error.
- User B does not see any of User A’s client data.
- Network tab shows the related requests failing.

**Failure Condition**
- If User B can view User A’s client data, mark this test as **FAIL - DO NOT LAUNCH**.

---

## Test 2: Project Data Isolation

**Steps**
1. In the User A browser:
   - Create a project.
   - Note the project ID from the URL.
2. In the User B browser:
   - Attempt to load User A’s project using the captured URL.

**Expected Result**
- User B receives an error response and cannot view User A’s project details.

---

## Test 3: Post/Calendar Data Isolation

**Steps**
1. In the User A browser:
   - Create a post and add it to the calendar.
   - Note the post ID (and associated calendar entry if visible).
2. In the User B browser:
   - Attempt to access the post directly by URL.
   - Attempt to view User A’s calendar.

**Expected Result**
- User B cannot access User A’s post or calendar entries, and any requests for that data fail.

---

## Test 4: API Direct Access Test (Advanced)

**Steps**
1. In the User B browser, open DevTools → Console.
2. Retrieve User B’s Supabase token:
   ```javascript
   localStorage.getItem('supabase.auth.token');
   ```
3. Copy the token value.
4. Try to fetch User A’s client data directly:
   ```javascript
   fetch('/api/clients/[USER_A_CLIENT_ID]', {
     headers: {
       Authorization: `Bearer [USER_B_TOKEN]`,
     },
   })
     .then((r) => r.json())
     .then(console.log);
   ```

**Expected Result**
- Response is a 403 Forbidden (or similar error).
- No information about User A’s client is returned.



