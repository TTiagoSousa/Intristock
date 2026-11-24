v1.2.0 — Call center, time bank and motorcycles

### Features
- **call-center**: a call center workspace for companies (a module with its own screen): data tables imported from .xlsx or .csv or typed by hand, with per-column filters and personal columns hidden from who can't see them, and joined tables that match two tables by one or more columns
- **call-center**: lead sections built from a table or a joined table and its filters, shown as boards with columns you drag cards across (also on touch screens); each lead opens a side drawer with the phone, the row data, comments and the history
- **call-center**: each section logs calls with its own outcome buttons (each one counts the attempt, moves the lead and can ask for a callback time), assigns leads to operators, sets callbacks with a reminder in the bell, and has search, quick filters (mine, unassigned, call today, stuck), a card limit per column and bulk move, assign and archive
- **call-center**: user-built automations per section, on the row data and on the lead itself (attempts, days in the column, assignee, callback due), that move, archive or assign leads in turn; they run on every read and in the background every 5 minutes
- **call-center**: a dashboard with calls per day, the answer rate, calls by operator and by outcome, open and unassigned leads, callbacks for today and overdue, and the time spent in each column
- **call-center**: a Shopify connection that fills a table with the store's orders (including whether the shipping address failed validation) and keeps it up to date every hour, day or week
- **time-tracking**: a time bank linked to solidtime: clients, projects, people and time entries synced on a schedule, hourly rates per client, payments from clients (by dates or by hours, with prepaid hours used up automatically) and payouts to the people who did the work
- **companies**: adding an account to a company is an invitation, salaries and freelance payments to a member with an account are proposals they accept or decline, and a payment to a member asks them to confirm it was received, which records it in their earnings
- **portfolios**: motorcycles as assets, valued from Facebook Marketplace listings via SerpApi, with the search, the excluded listings and the chosen price kept in a report; API keys with several accounts that rotate when one runs out
- **portfolios**: each broker connection syncs every hour, day or week

### Fixes
- **companies**: changing an accepted salary becomes a new proposal and the current one stays in force until it is accepted (it starts after the last paid month), so editing no longer hides it from the upcoming payments
- **companies**: marking a company-paid salary as received in Earnings links it to the payment and closes the confirmation in the bell; "not received" payments no longer stay pending, and hours paid through the time bank no longer show twice
- **companies**: open salary proposals are cancelled when a member is removed, and an invited person only sees proposals after accepting the invitation
- **security**: findings from a security, reliability and accessibility audit (login limits, sessions after a password change, encrypted secrets bound to their row, CSRF checks and more)
- **portfolios**: several portfolio calculation and display fixes

### Improvements
- **call-center**: the data and lead pages keep the table or the board inside the screen with their own scroll, and the header stays visible
