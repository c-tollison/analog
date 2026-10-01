# Shelves and Log

Agreed 2026-10-01. People got confused because their counts didn't match what they own. This plan splits what you own from what you've read, and reorganizes the app around one search.

## Words

| UI word     | Code word                          | Meaning                                                              |
| ----------- | ---------------------------------- | -------------------------------------------------------------------- |
| Shelf       | `collection`                       | A named group of things you own. Shared with members.                |
| Shelf entry | `collection_item`                  | One book on a shelf. Needs at least one edition.                     |
| Edition     | `catalog_item_isbn`, ISBN          | One printing of a book, like a 20th anniversary print.               |
| Book        | `catalog_item`                     | One volume or work, shared by everyone. Reviews and statuses go here. |
| Log         | `progress`                         | Your Want to read, Reading and Read lists, with ratings and reviews. |
| Series      | `series`                           | A run of volumes, like Bleach.                                       |

Only the UI and web URLs say "shelf". The database, API and composables keep "collection". CLAUDE.md should map the two.

## Rules

1. **Shelves count editions.** Two editions of Bleach vol 1 count as 2 on the shelf card.
2. **Series progress counts volumes.** Those two editions show as "1 of 74" volumes.
3. **The Log counts books.** You review and set a status on the book, not the edition. Both editions together are 1 "want to read". The progress bar's total is the number of books.
4. **A shelf entry needs an edition.** You can only put a book on a shelf by picking, typing or scanning an edition you own. Removing the last edition removes the entry. Your Log status stays.
5. **The Log is opt-in.** A book is on your Log only if you set a status. Adding to a shelf never sets one.
6. **Special editions are the same book.** A deluxe or anniversary print of the same volume is another edition of the same book.
7. **A different volume count means a different series.** For example, a 12 volume and an 8 volume Parasyte. Admins sort these out by hand, one book at a time. Jev doesn't check this.
8. **Covers come from the lowest volume.**
    - The shared series page and admin pages use the lowest volume in the app.
    - A shelf's series card and series page use the lowest volume you own on that shelf.
9. **Search only covers what's in the app.** If a book isn't there, people add it by ISBN-10, ISBN-13 or scan. New books and editions wait as unreviewed for an admin. Google title search is admin-only.

## Pages

### Top nav

- **Desktop:** "Analog" text on the left, linking to Shelves. Then Shelves, Log and Friends. The search bar sits in the middle. Notifications and the profile menu are on the right.
- **Mobile pill:** Shelves, Log, Search and Friends. The notifications bell moves to a mobile top bar.

### Search

- Clicking the bar opens a `Dialog` near the top. It's full screen on mobile, and Esc closes it.
- Tabs: **Books**, **Series**, **People** and **Shelves**. Each tab scrolls endlessly.
- **Book rows:** cover, a "#1 of 30 in Jujutsu Kaisen" badge, title, first author, release year, saves, average rating and the split button. The badge drops "of 30" when the series has no volume count.
- **The Shelves tab** searches books on every shelf you're a member of and shows which shelf each one is on. A series opens that shelf's series page. A book opens the shared book page.
- Your own unreviewed books show up with an "Unreviewed" badge. Other people's don't.
- **Ordering:** best match first. Ties go to the book with more saves.
- **Footer:** "Not here? Add by ISBN" opens a scan or type dialog. After the lookup, you land on that book's shared page.
- There are no past searches and no "See all results".
- **Search bars that go away:** the shelf list, the shelf page, Friends and the Look up tab. Admin pages and picker dialogs keep theirs.

### Split button

- The main part says "Want to read", or shows your status with a check.
- The arrow opens a menu with Want to read, Reading, Read, Remove from Log, a divider, then Add to shelf….
- It's built from `ButtonGroup` and `DropdownMenu`, and it's used in search and on the book page.

### Add to shelf dialog

- Pick a shelf, or name a new one if you have none.
- **Editions list:** paged with `LoadMore`. Editions you own on that shelf come first, then the main edition, then the rest. Owned ones start checked.
- One input filters the list by ISBN or publisher. A full, valid ISBN that isn't listed offers "Add this edition", which joins as pending. A scan button sits next to the input.
- Unchecking the last edition removes the book from that shelf.

### Shared book page: `/items/:catalogItemId`

- The same page whether you came from search, a shelf, or someone else's shelf.
- Shows the book, your status, rating and review, the split button, which of your shelves own which editions, and friends' reviews.
- It always shows the viewer's own data, never the shelf owner's.
- The old `collections/:id/items/:itemId` route is deleted with no redirect.
- **Later:** compare with friends: their status and editions next to yours.

### Shared series page: `/series/:id`

This is the one series page for you and your shelves. Agreed 2026-10-01.

- **Header:**
    - The cover is the lowest volume in the app, with the AniList details.
    - "5 of 12 owned · 3 read", and a bar for read, reading and want to read.
    - The total is the series' volume count, or the number of volumes in the app when no count is set.
- **Owned** means owned on any shelf you're a member of, including shared ones.
- **Toggle:** Owned, Missing and All, each with its count. Missing means volumes in the app you don't own.
    - It starts on Owned when you came from a shelf, and on All from search or a book page.
    - The choice is kept in the URL.
- **Not in Analog yet:** a line lists volume numbers with no book in the app, like "7, 9", with an Add by ISBN button. It only shows when the series has a volume count.
- **Each volume** has its cover, Owned badge, stars and a Log button. There are no bulk actions for now.
- **Coming from a shelf:** members link to `/series/:id?shelf=:shelfId`. The `shelf` part only sets "Back to Manga" and the starting toggle.
- **No X on this page.** Taking a book off a shelf goes through Add to shelf, and bulk scanning stays on the shelf page.

### Shelf series page: visitors only

- Someone viewing a friend's shelf gets a read-only page: the shelf's volumes, the owner's progress, and no buttons.
- The cover is the lowest volume on that shelf.
- A member who opens it is sent to the shared series page.
- Series cards in a shelf grid still count only that shelf, like "3 owned · 1 read".

### Log: `/log`

- Tabs: **Want to read**, **Reading** and **Read**. Music gets its own words later, like Listened, Listening and Want to listen.
- Want to read and Reading are grouped by series. A series opens the shared series page.
- Read is a diary: a flat list with the newest finished first.
- It shows on your profile and follows the profile's visibility, with no separate setting.

### Scan page: `/shelves/:id/scan`

- Its own page, since people leave it open for an hour while scanning a stack.
- It's the scanner plus a list of this session's scans. It has no Look up tab.
- Each scan adds that edition to the shelf. An unknown ISBN creates an unreviewed book. An edition that's already there shows "Already on this shelf". Scanning never sets a Log status.

## Pre-computed stats

- New columns on `catalog_item`: `saveCount`, `ratingAverage` and `ratingCount`.
- `saveCount` is the number of people with the book on their Log in any status. Ratings from everyone count, including private profiles, since only totals show.
- `refreshItemStats(itemId)` recounts one book from `progress`. It runs after every status or review change and after book merges. A one-time recount fills in existing data.
- **Later:** series totals, if friend comparison or series pages need them.

## Build order

Each step is its own branch from `main` and its own PR. Each one passes `pnpm check` and `pnpm build`.

### 1. Data rules

- [x] Migration that deletes shelf entries with no edition. Their `progress` rows stay.
- [x] The API refuses a shelf entry with no edition. Removing the last edition deletes the entry.
- [x] The shelf card counts editions. Series cards and the series page count volumes. The status counts and bar total count books.
- [x] The shelf grid's series cover is the lowest volume owned on that shelf, not `min(coverUrl)`.
- [x] `refreshSeriesCover` sorts by volume number first.
- [x] Stats columns, `refreshItemStats` and a one-time recount.
- [x] Moved up from step 3, because they added items with no edition: deleted `AddFromCatalogDialog`, the Look up tab, `POST /collections/:id/items`, `GET /collections/:id/catalog` and the user Google search route.

### 2. Shared pages

- [x] `/items/:id` shared book page.
- [x] `/series/:id` shared series page.
- [x] Split button.
- [x] Add to shelf dialog with the paged editions list.
- [x] Delete the `collections/:id/items/:itemId` route and point shelf series pages at `/items/:id`.
- [x] The scan page and the Add to shelf dialog share one camera, `BarcodeCamera`.

### 3. Search

- [x] Search dialog with the Books, Series, People and Shelves tabs.
- [x] Book rows with stats and the split button.
- [x] "Not here? Add by ISBN" dialog.
- [x] Remove the search bars on the shelf list, shelf page and Friends.
- [x] For now, a search button in the top nav and ⌘K or Ctrl+K open search. Step 4 moves it into the new nav.

### 4. Nav and Log

- [x] UI text says Shelves, and the web URLs move to `/shelves`. The name mapping is in CLAUDE.md.
- [x] Desktop top nav with "Analog" text and the search bar in the middle.
- [x] Mobile pill and mobile top bar with the bell.
- [x] `/log` page, and the Log on the profile.
- [x] `/shelves/:id/scan` route, and delete `/lookup`.
- [x] `/` goes to Shelves.
- [x] Search is full screen on phones.
- [x] Stats and a yearly goal at the top of the Log.

## Testing

Carson tests everything in the UI once all four steps land. Each step adds its checks here. A later step that changes a page updates that page's earlier checks.

### Step 1

1. A shelf with two editions of one book says 2 items on the shelf list. The progress bar still counts it as one book.
2. A series card in the shelf grid shows the cover of the lowest volume you own on that shelf.
3. A visitor's view of a friend's shelf series shows that shelf's lowest volume as the cover.
4. Unchecking an edition in Add to shelf updates the shelf's count. Unchecking the last one takes the book off that shelf. This replaced the old item page in step 2.
5. The series page's "Add more" button opens the scan page.
6. The scan page has no tabs and scans like before.
7. Setting a status or a review still works.
8. On prod after deploy, no shelf entry is missing an edition, and series covers show volume 1 where it has a cover.

### Step 2

1. Clicking any book on a shelf, on a shelf series page or in shelf search opens `/items/:id`.
2. The book page shows saves and the average rating, your status, your shelves with their edition counts, and the details.
3. The Log button with no status adds "Want to read". With a status, it opens the menu. The menu changes the status, removes it from the Log, and opens Add to shelf.
4. Marking something read that has no rating or review opens the review sheet. This works from every Log button: the book page, search rows and series volumes. Something you rated before, un-marked and marked read again doesn't ask again.
5. Add to shelf picks a shelf for you only when you have exactly one. With more, it starts empty and the editions list shows once you pick. After you've added to a shelf, a "Use {shelf}" button picks that one again in one click. Switching shelves updates which editions are checked, with owned editions listed first.
6. Typing in the filter narrows the list by ISBN, publisher or title. Typing a full ISBN that isn't listed shows "Add this edition". It joins as unreviewed and lands on the shelf.
7. The scan button opens the camera in the dialog. A scan fills in the filter.
8. A brand new account with no shelves can name a first shelf right in the dialog.
9. The Editions tab pages through editions and marks each with the shelves that own it, plus "Unreviewed" on pending ones.
10. The Reviews tab shows your review and everyone else's.
11. The series link on a book opens `/series/:id`. It shows the lowest volume's cover, the AniList details, your owned and read counts, and every volume with Owned and status marks.
12. A friend's shelf links to the same book page, and it shows your own status there, not theirs.
13. The shelf scan page still scans like before.
14. Add to shelf explains what to do: pick a shelf, check your editions, or search, type or scan one that's missing.
15. Opening a series from your shelf goes to the shared series page, and its back button says "Back to" and the shelf's name.
16. On the shared series page, each volume has the Log button under its cover, and all the buttons line up whether or not a volume has stars. It sets or changes the status and opens Add to shelf, without leaving the page. The label cuts off cleanly in narrow cards.

### Step 3

1. The search button in the top nav, or ⌘K / Ctrl+K anywhere, opens search. On a phone, the magnifying glass in the top bar opens it.
2. Books finds books by title or series name and a volume number, like "jujutsu 24". Each row shows the "#24 of N in …" badge, author, year, saves and average rating.
3. The Log button on a row sets a status without leaving search. Its menu opens Add to shelf.
4. Your own unreviewed books show with an "Unreviewed" badge. Other people's don't show at all.
5. Clicking a row opens the book page and closes search.
6. Series shows covers, kinds and volume counts, and opens the shared series page.
7. People needs 2 letters, shows Friend or Requested badges, and opens the profile.
8. Shelves finds books on your shelves and shared ones, shows the shelf name, and opens the shelf's series page or the book page.
9. Each tab scrolls endlessly.
10. "Not here? Add by ISBN" closes search and opens the scan or type dialog. A book already in the app opens its page straight away. A new one asks for series and volume, then saves and opens its page as unreviewed.
11. The shelf list, the shelf page and Friends have no search bar. The shelf page still sorts.

### Step 4

1. **Desktop top bar:** "Analog" on the left goes to Shelves. Next to it are Shelves, Log and Friends, with the current one outlined. The search bar sits in the middle, with the bell and profile menu on the right.
2. **Phone:** the top bar has "Analog", the bell and the profile menu. The pill at the bottom has Shelves, Log, Search and Friends, and fits a narrow phone.
3. Search on a phone fills the screen. On desktop it's a large panel near the top. The close button sits beside the search bar, not on top of it.
4. **URLs:** shelves live at `/shelves`, `/shelves/:id` and `/shelves/:id/series/:seriesId`. Old `/collections` links don't work.
5. **Wording:** every page says shelf or shelves, not collection. That covers titles, buttons, settings, profile settings, invites, confirm dialogs and error messages.
6. **Scan page:** a shelf's Add button and a series' "Add more" open `/shelves/:id/scan`. `/lookup` is gone.
7. **Log page:** it has Reading, Want to read and Read tabs.
    - Reading and Want to read show series cards with a volume count, plus single books.
    - Read lists each book with the date finished, the series and your stars, newest first.
8. Changing a status anywhere updates the Log.
9. **A profile:** it has Shelves and Log tabs.
    - On a friend's or a public profile, the Log shows only reviewed books.
    - A private profile you're not friends with says only friends can see its shelves and Log.
10. **Empty Log tabs:** they say "Nothing here yet." on yours and "Nothing here." on someone else's.

### Log stats and goal

1. The top of the Log has a stats card for this year:
    - read this year, read all time, reading, want to read, and average rating
    - a bar for each month, with a tooltip showing that month's count
2. With no goal, your Log shows "Set a goal for 2026". Setting one shows "N of goal", a progress bar, the percent, and how far ahead or behind an even pace you are. Once you hit it, it says "Goal reached".
3. The pencil on the goal card lets you change the goal or remove it. Typing 0 or nothing shows "Enter a number above 0".
4. Changing a status updates the stats and the goal right away.
5. On someone else's Log, both cards are read-only, and their goal shows if they set one. A visitor's counts leave out books that haven't been reviewed, like the rest of the Log.

### One series page

1. On your own shelf or a shared one, a series card opens `/series/:id`, not the shelf's series page. So do series results in the search Shelves tab.
2. The header shows "N of total owned · N read" and a bar for read, reading and want to read, counted across the whole series.
3. The toggle shows Owned, Missing and All with counts. From a shelf it starts on Owned, and from search or a book page it starts on All. Switching changes the URL, and going back keeps it.
4. Missing lists the volumes in the app you don't own on any shelf. Each one has a Log button, so you can mark it "Want to read" or open Add to shelf right there.
5. With a volume count set and gaps in the app, "Not in Analog yet: 7, 9" shows with an Add by ISBN button that opens the ISBN dialog.
6. Coming from a shelf, Back says "Back to" and the shelf's name, and goes there.
7. On a friend's shelf, the series card still opens their read-only shelf series page. It has their volumes and progress and no buttons.
8. Pasting your own shelf's old series link sends you to the shared page.
9. Owning an edition, or changing a status, updates the counts, the bar and the toggle counts.

## Not now

- Comparing with friends on the book page.
- Bulk actions on series, like marking 1–12 read.
- Past searches and a full results page.
- Renaming ISBN to barcode in code for music. The UI says "edition" already.
- Renaming `collection` to `shelf` in code.
