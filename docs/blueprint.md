# SignalTrader Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Monitors specified Telegram channels for trade signals from approved posters, auto-executes valid signals on MetaTrader, and sends execution confirmations only to the owner/admin. Stores all configuration and history for persistence across restarts.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- single owner/operator

## Success criteria

- All valid signals from approved posters are auto-executed on MetaTrader
- Owner receives execution confirmations in private chat
- Bot resumes operation with saved configuration after restarts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open admin menu with configuration options and status
- **/history** (command, actor: user, command: /history) — Show execution history and logs
- **Configure Channels** (button, actor: user, callback: config:channels) — Add or remove monitored Telegram channels
- **Manage Posters** (button, actor: user, callback: config:posters) — Add/remove approved signal posters

## Flows

### Signal Processing
_Trigger:_ New message in monitored channel

1. Verify poster is in approved list
2. Parse message for trade parameters
3. Submit order to MetaTrader
4. Send confirmation to admin
5. Log execution record

_Data touched:_ Signal Source, Approved Posters, Parsed Signal, Execution Record

### Admin Configuration
_Trigger:_ /start or config buttons

1. Display admin menu
2. Handle channel/poster configuration
3. Save changes to persistent storage

_Data touched:_ Signal Source, Approved Posters

### History Query
_Trigger:_ /history

1. Fetch execution history
2. Format and display logs

_Data touched:_ Execution Record

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Signal Source** _(retention: persistent)_ — Telegram channels monitored for trade signals
  - fields: channel_id, monitoring_status
- **Approved Posters** _(retention: persistent)_ — List of trusted signal posters by username/ID
  - fields: poster_id, username, approval_status
- **Parsed Signal** _(retention: session)_ — Extracted trade details from valid messages
  - fields: symbol, side, size, stop_loss, take_profit, expiry
- **Execution Record** _(retention: persistent)_ — Log of all attempted and successful trades
  - fields: timestamp, signal_source, parsed_signal, execution_status, broker_response

## Integrations

- **Telegram** (required) — Monitor channels and send admin notifications
- **MetaTrader Bridge** (required) — Auto-execute trade orders
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Add/remove monitored channels
- Approve/revoke signal posters
- View execution history
- Configure parsing rules

## Notifications

- Trade execution confirmation
- Failed execution alert with retry status
- Configuration change confirmation

## Permissions & privacy

- Bot only processes messages from approved posters
- All notifications are sent only to admin chat
- No user data stored beyond configuration and logs

## Edge cases

- Message from unapproved poster is ignored
- Unparsable message is logged but not executed
- MetaTrader API failure triggers retry and admin alert

## Required tests

- End-to-end signal processing from channel message to MetaTrader execution
- Admin configuration changes persist after restart
- Error handling for failed executions and invalid signals

## Assumptions

- Owner will provide initial channel(s) and approved posters
- Parsing rules will match common signal formats
- MetaTrader API will be available for execution
