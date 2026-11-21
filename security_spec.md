# Security Specification & Firestore Hardening Spec

## 1. Data Invariants
1. **User Identity & Multi-tenancy**: All store operations, orders, customers, and financial records belong strictly to the authenticated user owning the document tree `/users/{userId}/...`. No user may read, list, write, or mutate another user's records.
2. **Heartbeat Validation**: `/test/{testId}` documents permit read operations for live connectivity checks. Writes to test collections are denied.
3. **Immutability of IDs & Creation Dates**: The primary key `id` and initial timestamps (`createdAt`) cannot be altered or spoofed after creation.
4. **Action-Based Partial Updates**: Updates must only alter intended state and business fields (`status`, `paymentStatus`, `paidAmount`, `items`, `grandTotal`, etc.) without altering ownership or system keys.
5. **String Size and Type Constraints**: All text fields are strictly bound with length caps (`.size() <= MAX`) to prevent Denial-of-Wallet payload attacks.
6. **Path ID Integrity**: All document IDs must conform to `^[a-zA-Z0-9_\-]+$` and be 128 characters or fewer.

---

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity, or State)

1. **Payload 1 (Ghost Field Injection / Shadow Update):**
   Injecting `isAdmin: true` into an Order update.
   - Target: `/users/{userId}/orders/{orderId}`
   - Action: `update`
   - Expected Result: `PERMISSION_DENIED`

2. **Payload 2 (Cross-User Theft / Identity Spoofing):**
   Writing an order into another user's `/users/{victimId}/orders/{orderId}` when authenticated as `{attackerId}`.
   - Target: `/users/{victimId}/orders/{orderId}`
   - Action: `create`
   - Expected Result: `PERMISSION_DENIED`

3. **Payload 3 (Unauthenticated Read):**
   Attempting to list orders without authentication.
   - Target: `/users/{userId}/orders`
   - Action: `list`
   - Expected Result: `PERMISSION_DENIED`

4. **Payload 4 (Path Poisoning / Oversized Doc ID):**
   Creating a document with a 500-character malicious string ID.
   - Target: `/users/{userId}/products/` + 'A'.repeat(500)
   - Action: `create`
   - Expected Result: `PERMISSION_DENIED`

5. **Payload 5 (Denial of Wallet - 1MB String Value):**
   Creating a product with a 1MB `name` payload.
   - Target: `/users/{userId}/products/prod-1`
   - Payload: `{ name: "A".repeat(500000), price: 100 }`
   - Expected Result: `PERMISSION_DENIED`

6. **Payload 6 (Immutable Field Tampering - createdAt):**
   Attempting to overwrite `createdAt` with a fabricated past date during an update.
   - Target: `/users/{userId}/orders/{orderId}`
   - Action: `update`
   - Expected Result: `PERMISSION_DENIED`

7. **Payload 7 (Missing Required Fields):**
   Creating an order without `grandTotal` or `customerName`.
   - Target: `/users/{userId}/orders/ord-test`
   - Payload: `{ id: "ord-test" }`
   - Expected Result: `PERMISSION_DENIED`

8. **Payload 8 (Negative or Invalid Financial Types):**
   Setting `price` to a string or boolean instead of a number.
   - Target: `/users/{userId}/products/prod-test`
   - Payload: `{ id: "prod-test", name: "Paracetamol", price: "Free" }`
   - Expected Result: `PERMISSION_DENIED`

9. **Payload 9 (Blanket Query Scraping Attack):**
   Attempting an unrestricted collectionGroup query across all users' orders.
   - Target: Collection group query on `orders`
   - Expected Result: `PERMISSION_DENIED`

10. **Payload 10 (Delete Victim Account Records):**
    Attacker sending a DELETE request to another user's customer record.
    - Target: `/users/{victimId}/customers/{customerId}`
    - Action: `delete`
    - Expected Result: `PERMISSION_DENIED`

11. **Payload 11 (Unauthenticated Write to Test Heartbeat Doc):**
    Attempting to write to `/test/connection` without auth or with auth.
    - Target: `/test/connection`
    - Action: `write`
    - Expected Result: `PERMISSION_DENIED`

12. **Payload 12 (Root Catch-all Breach):**
    Attempting to create documents in arbitrary non-blueprint collections (e.g. `/system_secrets`).
    - Target: `/system_secrets/keys`
    - Action: `write`
    - Expected Result: `PERMISSION_DENIED`

---

## 3. Security Test Runner (firestore.rules.test.ts)
The test suite ensures that rules reject all 12 dirty payloads.
