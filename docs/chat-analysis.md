# WhatsApp Chat Analysis: Precious Metals Trading Business

## Source Files
- **Chat 1 (SAPAN-HK):** 301 lines, date range 16/3/2026 - 9/4/2026 (silver-focused, smaller deals)
- **Chat 2 (8hk-Gold/PD/USDT Tak Fung):** ~5200+ lines, date range 31/5/2023 - 3/6/2025 (gold and palladium, large-scale deals)

---

## 1. PARTICIPANTS

### Chat 1: SAPAN-HK (Silver Deals)

| Name | Role | Notes |
|------|------|-------|
| **~ Sapan** | Buyer / Client | Initiates buy requests for silver. Asks for price, quantity, locks deals. |
| **~ Max** | Sales / Dealer | Quotes premiums (+1, +1.2), approves/rejects orders, manages deal flow. |
| **ANGEL BOSS** | Senior dealer / Boss | Confirms stock availability, resolves disputes, manages warehouse operations. Chinese-speaking. |
| **Lin** | Trader / Execution desk | Executes buy/sell at spot, quotes spot price, confirms "Locked" or "Cancelled", manages limit orders. |
| **Gusini** | Accountant / Calculator | Computes deal amounts (price formulas), shares USDT wallet addresses, posts settlement statements (images). |
| **Adam Yogesh** | Treasury / Wallet manager | Manages USDT wallets, confirms receipt of payments ("recvd", "RECVD"), rotates wallet addresses, pins new wallet messages. |
| **~ OE Jewellery Ltd** | Intermediary / Agent (Chinese-speaking client) | Places orders on behalf of end-clients, arranges physical collection, communicates in Chinese with the team. |
| **Johan** | Operations / Admin | Created the group. Handles logistics, confirms physical deliveries, provides weight confirmations. |
| **Lucifer** | Unknown (added late) | Added by ANGEL BOSS on 4/4/2026. No meaningful messages observed. |

### Chat 2: 8hk-Gold/PD/USDT Tak Fung (Gold & Palladium Deals)

| Name | Role | Notes |
|------|------|-------|
| **Boss** (also "8hk-Gold/PD/USDT Tak Fung") | Primary dealer / Buyer-Seller | Initiates most deals. Sends metal to "Tak Fung" (Austin's company). Requests USDT payments. Directs Robin and Gui. |
| **~ Austin** | Tak Fung side - Senior dealer | Counterparty to Boss. Arranges payments, requests wallets, manages physical delivery/collection. |
| **~ Tim** | Fixing desk / Compliance | Manages LBMA AM/PM fixing process. Confirms "working" for fixing orders. Confirms settlements ("all settled, thanks"). |
| **Robin** | Boss's logistics / Runner | Physical delivery and collection. Posts "Paid Xkg tak fung" with photos. Picks up and delivers metal bars. Uses ALL CAPS frequently. |
| **~ CAROL (stylized as "~ C A R O L")** | Tak Fung operations / Vault manager | Manages vault, confirms receipt of metals, coordinates physical handoffs, handles compliance (account opening forms, KYC docs). |
| **Gusini** | Accountant / Bookkeeper | Computes settlement amounts, posts daily settlement statements (images), tracks running balances. Same person across both chats. |
| **Gui** | Boss's treasury / Payment handler | Receives USDT wallet addresses, sends USDT payments, confirms "Recd" / "recd". |
| **Adam Yogesh** | Tak Fung treasury (from Jan 2025) | Added to group in Jan 2025, manages USDT wallet addresses for Tak Fung side. Confirms received payments. Same person as in Chat 1. |
| **Li-N madam** | Fixing desk / Recorder | Posts formal fixing messages: date, metal, AM/PM Fix, buy/sell, weight. Confirms fixing prices. |
| **Lin** | Fixing desk (later period) | Takes over some of Li-N madam's fixing duties. Also quotes spot prices, confirms fixing prices. |
| **Johan** | Operations / Logistics | Physical metal deliveries, receives/pays metals. Also handles export logistics (Ferrari shipments). |
| **ANGEL BOSS** | Same as in Chat 1 | Appears in both groups. Manages warehouse/vault operations. |
| **Flicks** | Delivery person / Runner | Handles on-ground token-based metal handoffs. One-time appearance. |
| **Viraj Bhai** | Unknown (added late) | Added 1/6/2025. No messages observed. |

---

## 2. LANGUAGES

### Chat 1: SAPAN-HK
- **English:** ~65% - Primary business language for deal execution (prices, locking, quantities)
- **Chinese (Traditional + Simplified):** ~30% - Used by OE Jewellery Ltd, ANGEL BOSS, Gusini, Lin for internal coordination
- **Mixed:** ~5% - Some messages switch mid-conversation

Key Chinese phrases observed:
- "已付12公斤" = "Paid 12kg"
- "付款前请先测试小笔金额" = "Please test a small amount before payment"
- "付10kg" = "Paid 10kg"
- "可以發中文" = "Can send in Chinese"
- "250kg 款已收齐" = "250kg payment fully collected"
- "可放貨" = "Can release goods"
- "平倉" = "Close position" (flatten hedge)
- "鎖價" = "Lock price"
- "掛單" = "Pending order"
- "现在确定" = "Confirm now"
- "晚了就要亏钱的" = "If late, will lose money"
- "沒有留u都用完了" = "No USDT left, all used up"
- "珠子" = "Beads/balls" (silver form factor)

### Chat 2: 8hk-Gold/PD/USDT Tak Fung
- **English:** ~85% - Primary deal language
- **Chinese:** ~10% - Occasional (ANGEL BOSS, Gusini, Robin in later messages)
- **Mixed:** ~5%

Key Chinese phrases:
- "收到" = "Received" (used by Gui, Austin)
- "好的挂单" = "OK, pending order"
- "已付250公斤" = "Paid 250kg"
- "做幾多?" = "How many to do?"
- "AM fix 要做吗?" = "Need to do AM fix?"
- "已交6条" = "Delivered 6 bars"
- "收到30k" = "Received 30kg"
- "密码" = "Password" (token code)

---

## 3. DEAL FLOW PATTERN

### Pattern A: Silver Spot Deal (Chat 1 - SAPAN-HK)

**Step-by-step sequence:**

1. **Inquiry** - Buyer asks for availability and price:
   - `~ Sapan: Can we book 10 kgs`
   - `~ Sapan: Hello do we have ce stock for Tomm`

2. **Premium quoted** - Dealer provides premium over spot:
   - `~ Max: +1.2` (meaning spot price + $1.20/oz)
   - `~ Max: +1 net`

3. **Negotiation** (optional):
   - `~ Sapan: Need to book 500 kgs ? Can we do at .9`
   - `~ Max: No`

4. **Order placed** - Buyer confirms buy:
   - `~ Sapan: Buy fix limit 64.5 for 10 kgs`
   - `~ Max: @Lin buy 10kg silver spot`

5. **Spot price captured** - Trader quotes current spot:
   - `Lin: 70.51`
   - `Lin: Buy 10k`

6. **Calculation** - Accountant computes total USDT:
   - `Gusini: 70.51+1.2=71.71/31.1035*10000=23055.28`

7. **Lock confirmation** - Both sides confirm:
   - `Lin: Locked`
   - `ANGEL BOSS: Locked`

8. **Wallet shared** - Treasury provides USDT wallet address:
   - `Gusini: TKgNpBkN6gn4Txs8PMQrhJfC9enL3wZvcB`
   - `Gusini: Please test the small amount before payment`

9. **Payment** - Client sends USDT (test amount first, then full):
   - `~ OE Jewellery Ltd: <photo>` + `Check`
   - `Adam Yogesh: recvd`
   - Repeat for remaining amounts

10. **Payment confirmed** - Accountant confirms collection complete:
    - `Gusini: The money has been collected.`
    - `Gusini: 250kg 款已收齐` (payment fully collected)

11. **Physical delivery** - Client sends "token" (authorization), goods released:
    - `~ OE Jewellery Ltd: Client coming`
    - `~ Max: Send token`
    - `~ OE Jewellery Ltd: Client done`
    - `~ OE Jewellery Ltd: Can give the goods`

12. **Delivery confirmed** - Warehouse confirms handover with photo:
    - `Gusini: 付10kg <photo>` (Paid/delivered 10kg)

13. **Hedge management** (if applicable) - Trader manages position:
    - `Lin: Limit sell 100k@72.416 order working`
    - `Lin: Filled 平仓了` (Position closed/hedged)

### Pattern B: Gold Large Bar Deal (Chat 2 - Tak Fung)

**Step-by-step sequence:**

1. **Deal initiation** - Boss specifies quantity, discount, and delivery timing:
   - `Boss: 150kg @ +1 Tomorrow delivery`
   - `Boss: 130kg @ -0.2%`
   - `Boss: 120kg sold @ -20`
   - `Boss: 100kg PD pm fix working`

2. **Wallet request** - Buyer asks for USDT wallet:
   - `~ Austin: Wallet plz`
   - `Boss: TKz1x8uQbFF1ZmCoej2Cy7scqfn5sjduGU` (or "Same wallet")

3. **USDT payment** - Multiple tranches with screenshot confirmation:
   - `~ Austin: <payment screenshot>`
   - `Gui: Recd` / `Adam Yogesh: Received`
   - Payments often in millions (2m, 5m, 10m, 20m USDT)

4. **Bar list shared** - Detailed list of bars with serial numbers:
   - `Robin: 156026.40 Grams (13 pcs) <photo>`
   - Excel files shared: `20241223-35kg.xlsx`

5. **Physical delivery** - Metal bars transported between offices:
   - `Robin: Paid 152102.10 Grams (12 Pcs) <photo>`
   - `~ CAROL: Given 83kg <photo>`
   - Room references: "432" (Boss's office), "609"

6. **AM/PM Fixing** - Formal LBMA price fixing:
   - `Li-N madam: 15th November 2024 XAU AM Fix We sell Pure 272318.6 grams`
   - `~ Tim: working`
   - Li-N madam: `OK`

7. **Fix price published** - After London fixing:
   - `Li-N madam: 2566.7+0.1=2566.8`
   - Format: `[LBMA fix price]+0.1=[settlement price]` (always +0.1 or -0.1 commission)

8. **Settlement calculation** - Gusini posts statement image:
   - `Gusini: <settlement statement image>`
   - `Gusini: The boss still needs to pay us 1022385usdt`

9. **Final settlement** - Balance paid or refunded:
   - `~ Austin: 46133 to be paid` then payment screenshot
   - `~ Tim: all settled, thanks.`

### Pattern C: Palladium (PD) Deal

1. **Deal terms quoted with discount per oz:**
   - `Boss: -15/oz` or `Boss: -29 net price`
   - `Boss: 100kg PD pm fix working We sell and you buy`

2. **Calculation formula (PD):**
   - `Gusini: 960-15=945*32.1507*0.49516=15044`
   - `Gusini: 944-33=911/31.1035*150000=4393396`
   - `Gusini: 934-33=901/31.1035*48482.5=1404431`

3. **Physical collection** requires company chop (stamp) and vault tokens:
   - `~ CAROL: Please bring NEPTUNE chop for picking up stock`

---

## 4. KEY WORDS AND PHRASES

### Locking a Deal
- `Locked` - Deal confirmed at quoted price (Lin, ANGEL BOSS)
- `Lock` / `lock` - Request to lock price
- `鎖價` - Lock price (Chinese)
- `fix` / `Fix` - Fix at current spot
- `Working` - Order is being executed (Lin, Tim)
- `Cfm` / `cfm` - Confirm

### Buying
- `Buy` / `buy` - Direct buy instruction
- `Book` / `book` - Reserve/order
- `We buy` - Formal buy declaration
- `Collect` - Physical collection of metals
- `Need` - Request for quantity

### Selling
- `Sell` / `sell` - Direct sell instruction
- `We sell` - Formal sell declaration
- `sold` - Deal completed
- `U sell` - "You sell" instruction

### Price Quotes
- `+1` / `+1.2` / `+0` - Premium per troy oz over spot (silver, Chat 1)
- `-15/oz` / `-3` / `-4` / `-4.8` / `-6` / `-6.5` / `-8` / `-10` / `-11` / `-20` / `-30` - Discount per troy oz (gold/PD, Chat 2)
- `-0.2%` / `-0.20%` / `-0.225%` / `-0.23%` / `-0.25%` / `-0.29%` / `-0.30%` / `-0.40%` / `-0.50%` - Percentage discount (gold, Chat 2)
- `+0.1` / `-0.1` - Commission/spread on fixing price (always exactly 0.1)
- `net` - All-in price, no further adjustments
- `spot` - Current market price

### Quantities
- `10 kgs` / `10kg` / `10k` - 10 kilograms (k = kg in this context, NOT thousands)
- `100k` - 100 kilograms (context-dependent, means 100,000 grams = 100kg)
- `250kg` / `250 kg` - 250 kilograms
- `500 kgs` - 500 kilograms
- `4 LB` - 4 London Good Delivery large bars (~12.5kg each)
- `7 Lbs` - 7 large bars
- `pcs` - Pieces (bars)
- `grams` / `G` / `g` - Grams for precise weights (e.g., "99850.33 GRAMS")

### Metals
- **Silver:** `silver`, `sliver` (typo), `ball` (silver balls), `珠子` (beads/balls), `ce` (appears to be shorthand)
- **Gold:** `gold`, `XAU`, `9999` (purity designation), `bar`, `LB` (London bars/large bars), `LAC` (local bars), `chain` (gold chain for remelting), `scrap`, `kilo bar`, `blank bars`
- **Platinum:** `PT`, `platinum`
- **Palladium:** `PD`

### Payment Confirmations
- `recvd` / `RECVD` / `Recd` / `RECD` / `recd` - Received (most common)
- `received` / `Received` / `RECEIVED` - Full word variant
- `RECEVD` / `Recevd` / `recevd` - Typo variant (Robin's style)
- `收到` - Received (Chinese)
- `Got` / `Got it` - Acknowledged receipt
- `Check` / `check` / `查` - Request to verify payment
- `Check +` / `Done +` - Payment confirmed with checkmark
- `paid` / `Paid` / `PAID` - Confirmation of payment sent

### Cancellations
- `Cancel` / `cancel` - Cancel order
- `Cancelled` / `cancelled` - Order cancelled
- `Cancel this order` - Explicit cancellation
- `平倉` / `平仓` - Close/flatten position (related to cancelling hedge)

### Other Key Terms
- `Token` - Physical authorization code for warehouse collection
- `Swap` - Exchange one type of bar for another (e.g., LBMA bars for local bars)
- `Borrow` - Temporary metal loan
- `Melt` / `Remelt` / `Recast` - Convert scrap/chain to bar form
- `4N` - Four nines purity (99.99%)
- `Barlist` / `bar list` - List of bar serial numbers and weights
- `AM fix` / `PM fix` / `AM fixing` / `PM fixing` - LBMA Gold Price fixing sessions
- `Brinks` - Brinks secure vault/facility
- `Ferrari` - Ferrari logistics/shipping company for metal transport
- `Chop` - Company stamp/seal required for collection authorization

---

## 5. PRICE FORMAT

### Silver (Chat 1)
- **Format:** Spot price + premium per troy ounce
- **Example:** `70.51+1.2=71.71` (spot $70.51/oz + $1.20 premium = $71.71/oz)
- **Unit:** USD per troy ounce

### Gold - Fixing (Chat 2)
- **Format:** LBMA fix price +/- 0.1 (commission)
- **When selling:** `2566.7+0.1=2566.8` (fix + 0.1)
- **When buying:** `2917.7-0.1=2917.6` (fix - 0.1)
- **Plus discount:** Applied separately, e.g., `-4`, `-8`, `-0.2%`
- **Unit:** USD per troy ounce

### Gold - Spot/Discount
- **Absolute discount per oz:** `@ -4`, `@ -8`, `@ -10`, `@ -20`
- **Percentage discount:** `@ -0.2%`, `@ -0.30%`, `@ -0.50%`
- **Example calculation:** `2613.85-4=2609.85/31.1035*67000=5621873`

### Palladium (PD)
- **Format:** Spot price - discount per oz, sometimes with separate "fixing cost"
- **Example:** `960-15=945` (spot $960/oz minus $15 discount = $945/oz net)
- **Example:** `978-29=949/31.1035*99367.9=3031818` (discount of $29/oz applied first)
- **Example:** `944-33=911/31.1035*150000=4393396` (discount $33/oz)

### Calculation Formula (universal)
```
(price_per_oz) / 31.1035 * weight_in_grams = USDT_amount
```
OR equivalently:
```
(price_per_oz) * 32.1507 * weight_in_kg = USDT_amount
```

Note: **31.1035 grams = 1 troy ounce** and **32.1507 = 1000/31.1035** (grams-per-kg conversion factor for troy ounces).

Both conversion factors are used interchangeably:
- Gusini uses `/31.1035*grams`: `72.416+1=73.416/31.1035*100000=236038`
- Gusini also uses `*32.1507*kg`: `72.091+1=73.091*32.1507*105=246742.32`

---

## 6. PAYMENT METHODS

### USDT (Primary)
- **Network:** TRC-20 (Tron) - all wallet addresses start with `T`
- **Wallet addresses observed (Tak Fung / Austin side):**
  - `TSTpBmJZmy5WrTt1XYok1NhMSP7tYMD2oe` (early, May 2024)
  - `TTYEU9vs2inSsmdoSmrd5RNWd5eiJqBMPW` (Nov-Dec 2024)
  - `TPzxrDU8wPPAE3YSrq7UStUJ8Mt2okyydz` (Dec 2024, PD-specific)
  - `TSi2Sr9btdvh6mZC7ntSYWz77RF3ckdNVD` (Jan 2025 onward)
  - `TTT3jYqxHCPTCtocwaaKfFkV6E5vUwcEh9` (Jan 2025, Adam Yogesh managed)
  - `TAsx82S1hR3NPndqh1afh8rKDHmMjTVA33` (Jun 2025)
  - `TPMb6bMxkTDVb7B4dssz6xfgqMkjkHvQVp` (Jun 2025)
- **Wallet addresses observed (Boss / 8hk side):**
  - `TKz1x8uQbFF1ZmCoej2Cy7scqfn5sjduGU` (primary, used throughout)
  - `TKgNpBkN6gn4Txs8PMQrhJfC9enL3wZvcB` (Chat 1, early)
  - `TXXtqNBUQNnVExFL8MfX14n4KpLAUX5ZAA` (Chat 1, rotated)
  - `TRF6sKakfvwhrvfAaVwSX7SF7WW5QiyB3e` (Chat 1, rotated)
  - `TBwgJDCXLXfVDa9KMciVCZ5oLqf5kxfvMj` (Chat 2)

**Wallet rotation protocol:**
- `Adam Yogesh: THIS IS OUR *NEW WALLET* FOR NEXT PAYMENT PLEASE SEND HERE`
- Always accompanied by: audio message + pinned message
- Test small amount before large payment is standard practice

**Payment confirmation pattern:**
1. Sender: `<payment screenshot>` (blockchain transaction screenshot)
2. Receiver: `recvd` / `Received` / `Got` / `Got it` / `收到`

### HKD Cash (Secondary)
- Physical cash for smaller amounts and service fees
- `Robin: Paid 30400hkd <photo>`
- `Robin: Paid 15500hkd <photo>`
- `Robin: Paid 9000 hkd`
- Rate seems to be approximately HKD 150-250 per kg for swap/processing fees
- `~ Austin: 30x150=HKD4500` (30kg swap at HKD150/kg)

### AED Cash (Rare - Dubai operations)
- `Boss: 2415 aed` (export charge)

### Deal amounts observed:
- Silver deals: 23,055 - 651,052 USDT
- Gold deals: 85,000 - 24,700,000 USDT per day
- PD deals: 15,044 - 4,393,396 USDT
- Total daily volumes can exceed 20M+ USDT

---

## 7. CALCULATION PATTERNS

### Who calculates?
**Gusini** is the dedicated calculator/accountant in both groups.

### Silver Formula (Chat 1)
```
(spot + premium) / 31.1035 * weight_in_grams = USDT_amount
```
Examples:
- `70.51+1.2=71.71/31.1035*10000=23055.28` (10kg silver)
- `72.416+1=73.416/31.1035*100000=236038` (100kg silver)

Alternative using kg multiplier:
- `72.091+1=73.091*32.1507*105=246742.32` (105kg silver)
- `71.434+1=72.434*32.1507*80=186304.30` (80kg silver)
- `74.171+1=75.171*32.1507*65=157092.02` (65kg silver)

Multi-lot netting:
```
246742.32+186304.3+157092.02=590138.64-651052=-60913存
```
(Total owed minus total paid = -60913 credit/deposit remaining)

### Gold Formula (Chat 2)
```
(fixing_price + 0.1 [commission]) / 31.1035 * weight_in_grams = base_amount
```
Then apply discount:
- `2613.85-4=2609.85/31.1035*67000=5621873` (67kg gold at -$4/oz discount)

Or with percentage discount:
- Applied as a separate line item, calculated by Gusini in the statement image

### Palladium Formula
```
(spot_price - discount) / 31.1035 * weight_in_grams = USDT_amount
```
OR
```
(spot_price - discount) * 32.1507 * weight_in_kg = USDT_amount
```
Examples:
- `960-15=945*32.1507*0.49516=15044` (0.495kg PD)
- `978-29=949/31.1035*99367.9=3031818` (~99.4kg PD)
- `944-33=911/31.1035*150000=4393396` (150kg PD)
- `944-33=911/31.1035*70252.9=2057659` (70.25kg PD)

### Fixing Commission
- When "we sell": fix price + 0.1 (e.g., `2566.7+0.1=2566.8`)
- When "we buy": fix price - 0.1 (e.g., `2917.7-0.1=2917.6`, `3015.4-0.1=3015.3`)

### Settlement Pattern
Gusini posts a settlement image (spreadsheet/table screenshot) at the end of each day, followed by:
- `Gusini: The boss still needs to pay us [X]usdt` or
- `Gusini: [X]usdt` (balance owed)
- `~ Tim: all settled, thanks.` (after everything is cleared)

### Cash fee for swaps
- `Boss: Cost 250hkd per kg` (swap fee)
- Standard HKD 150/kg for swap processing: `~ Austin: 30x150=HKD4500`
- `Robin: 147+117=264*150=39600` (264kg total swap at HKD150/kg)

---

## 8. IMAGE PATTERNS

Images serve specific functions in the deal flow:

| Image Type | Who Posts | Purpose | Example |
|-----------|----------|---------|---------|
| **Payment screenshot** | Sender (Austin, Gui, Adam Yogesh, OE Jewellery, Boss) | Proof of USDT transfer (blockchain TX) | `~ Austin: <photo>` followed by `Gui: Recd` |
| **Bar list / Weight proof** | Robin, CAROL | Record of bars with serial numbers and weights | `Robin: Paid 152102.10 Grams (12 Pcs) <photo>` |
| **Delivery receipt** | Robin, Johan, CAROL | Proof of physical metal handover | `Robin: Received 83kg <photo>` |
| **Settlement statement** | Gusini | Daily/deal settlement spreadsheet | Posted at end of day, always by Gusini |
| **Weighing photo** | ANGEL BOSS, CAROL | Scale photos showing exact weight | Posted during weight disputes |
| **Purity test** | CAROL | XRF/fire assay results | `~ CAROL: Checked on the dirty part, is 9999` |
| **Token/Authorization** | CAROL, Austin | Physical token for vault collection | `~ CAROL: <photo>` (token image) |
| **Cash payment** | Robin | Photo of HKD cash | `Robin: Paid 30400hkd <photo>` |
| **Compliance docs** | Robin, CAROL | Account opening forms, BR, CI | PDF/DOCX attachments |
| **Bar list Excel** | CAROL, Robin | Detailed bar inventory spreadsheets | `20241223-35kg.xlsx` |

### Audio Messages
- Only Adam Yogesh posts audio messages, always when announcing new wallet addresses

---

## 9. GROUP DYNAMICS

### Chat 1: SAPAN-HK
- **Type:** Multi-party deal group with ~8 active participants
- **One conversation at a time** - sequential deal processing
- **Simultaneous concerns:** While one deal executes, sub-conversations about:
  - Stock availability
  - New wallet addresses
  - Weight disputes (the 10g discrepancy incident)
  - Client coordination (OE Jewellery bridging between Chinese-speaking clients and English-speaking dealers)
- **Power dynamic:** ANGEL BOSS and Max make decisions; Lin executes trades; Gusini calculates; Adam Yogesh manages payments

### Chat 2: 8hk-Gold/PD/USDT Tak Fung
- **Type:** Bilateral deal group between two companies (Boss/"8hk" and Austin/"Tak Fung")
- **Multiple deal types** run simultaneously:
  - Gold large bar deliveries (primary volume)
  - Gold kilo bar swaps (LBMA <-> local/Dubai brands)
  - Palladium deals (separate pricing structure)
  - Gold chain/scrap remelting services
  - Bar borrowing arrangements
- **High volume:** Multiple deals per day, daily volumes often in the millions of USDT
- **Relationship:** Long-term business relationship with informal tone ("boss", "brother", emojis, holiday greetings)
- **Dual-direction flow:** Both sides buy AND sell to each other; positions are netted via LBMA fixing

### Cross-Group Participants
The following people appear in BOTH groups, confirming they are the same business entity:
- **Gusini** - Accountant
- **ANGEL BOSS** - Senior dealer
- **Adam Yogesh** - Treasury/wallet manager
- **Johan** - Operations
- **Lin** - Trader

---

## 10. ANOMALIES

### Weight Discrepancy (Chat 1, 7/4/2026)
- `~ OE Jewellery Ltd: 客人說20kg的少10克` (Client says 20kg is short 10 grams)
- ANGEL BOSS insists weights are correct, citing on-site verification
- Discussion about bag weight ("皮30克一袋" = bag weighs 30g each)
- Resolved by asserting the client's scale was wrong
- Multiple photos of weighing evidence shared

### Cancelled Orders
- **Chat 1:** `~ Max: Cancel this order` (30/3/2026) and `Lin: Cancelled` (order that was "working")
- **Chat 2:** AM fixing cancelled last minute on 8/4/2025 because Austin couldn't place his side before cutoff; Boss managed to cancel over phone

### Premature Price Lock (Chat 1, 7/4/2026)
- OE Jewellery confused: price was locked before any USDT was received
- `~ OE Jewellery Ltd: 但客人還沒有打U呢 怎麼就鎖價了？` (Client hasn't sent USDT yet, how was price locked?)
- ANGEL BOSS: `那你群里不要叫锁价啊` (Then don't call for lock price in the group)
- Resolved by unwinding the lock and re-establishing correct order (pay first, then lock)

### Wallet Address Changes
- Adam Yogesh rotates wallet addresses frequently with a specific ritual:
  1. Posts new address
  2. Posts "THIS IS OUR *NEW WALLET*" (with bold formatting)
  3. Sends audio message
  4. Pins the message
- At least 7 different wallet addresses used across both chats

### Fake Brand Bars (Chat 2, 7/3/2025)
- `~ CAROL: received 23kg swap bars, but we can only take 5kg as 18kg are fake brand`
- Boss: `Ok then recast it ok?`
- Required remelting of non-genuine branded bars

### Melt Loss
- Regular occurrence when converting chain/scrap to bars
- `~ CAROL: melt loss: 46.57g` (on 92.998kg chain)
- `Robin: TOTAL MELTING LOSS 37.77+18.09=55.86/2=27.93-18.07=9.84`
- Shared 50/50 between parties

### Fixing Cutoff Issue (Chat 2, 8/4/2025)
- Austin missed the LBMA AM fixing cutoff
- Lin: `Can not cancel` (fixing already submitted)
- Austin: `Ok I take it, I will handle on spot`
- Boss managed to cancel over phone call
- Moved to PM fixing instead

### USDT Shortage (Chat 1, 9/4/2026)
- Client overpaid and needed refund
- `ANGEL BOSS: 没有留u都用完了` (No USDT left, all used up)
- Client needed funds for another order; temporary cash flow issue

### Export/Logistics Coordination
- Ferrari logistics and Brinks vault used for secure transport
- `Boss: Send token and ship it along with our export` (Dubai shipment)
- Company chop (seal) required for vault collection at Brinks
- Token system used for warehouse authorization

---

## SUMMARY: Key Bot Design Implications

### Message Classification Categories
1. **Deal initiation** - Buy/sell request with quantity
2. **Price quote** - Premium/discount communication
3. **Price lock/confirmation** - Locking deal at specific price
4. **Calculation** - USDT amount computation
5. **Wallet request/share** - Payment address exchange
6. **Payment proof** - Screenshot + confirmation
7. **Physical delivery** - Metal handover with proof
8. **Fixing order** - LBMA AM/PM fixing request
9. **Fixing result** - Published fixing price
10. **Settlement** - End-of-day balance statement
11. **Logistics** - Office/vault coordination
12. **Administrative** - Compliance, KYC, wallet rotation

### Critical Data Points to Extract
- **Metal type:** Gold (XAU), Silver, Platinum (PT), Palladium (PD)
- **Direction:** Buy or Sell
- **Quantity:** In kg or grams
- **Price type:** Spot, AM fix, PM fix
- **Premium/Discount:** Per oz ($) or percentage (%)
- **USDT amount:** Calculated settlement amount
- **Wallet address:** TRC-20 address
- **Status:** Working, Locked, Cancelled, Settled

### Constants for Calculations
- 1 troy ounce = 31.1035 grams
- 1 kg = 32.1507 troy ounces (1000/31.1035)
- Commission on fixing: +0.1 (sell) or -0.1 (buy) per oz
- USDT network: TRC-20 (Tron)
