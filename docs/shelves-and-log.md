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

- The cover is the lowest volume in the app.
- Shows the AniList details and every volume in the app, with your Log status and owned marker on each.
- There are no bulk actions for now.

### Shelf series page

- The cover is the lowest volume you own on that shelf.
- Each volume links to the shared book page.

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

- [ ] Search dialog with the Books, Series, People and Shelves tabs.
- [ ] Book rows with stats and the split button.
- [ ] "Not here? Add by ISBN" dialog.
- [ ] Remove the search bars on the shelf list, shelf page and Friends.

### 4. Nav and Log

- [ ] UI text says Shelves, and the web URLs move to `/shelves`. Add the name mapping to CLAUDE.md.
- [ ] Desktop top nav with "Analog" text and the search bar in the middle.
- [ ] Mobile pill and mobile top bar with the bell.
- [ ] `/log` page, and the Log on the profile.
- [ ] `/shelves/:id/scan` route, and delete `/lookup`.
- [ ] `/` goes to Shelves.

## Testing

Carson tests everything in the UI once all four steps land. Each step adds its checks here. A later step that changes a page updates that page's earlier checks.

### Step 1

1. A shelf with two editions of one book says 2 items on the shelf list. The progress bar still counts it as one book.
2. A series card in the shelf grid shows the cover of the lowest volume you own on that shelf.
3. The shelf series page header shows that same cover.
4. Unchecking an edition in Add to shelf updates the shelf's count. Unchecking the last one takes the book off that shelf. This replaced the old item page in step 2.
5. The series page's "Add more" button opens the scan page.
6. The scan page has no tabs and scans like before.
7. Setting a status or a review still works.
8. On prod after deploy, no shelf entry is missing an edition, and series covers show volume 1 where it has a cover.

### Step 2

1. Clicking any book on a shelf, on a shelf series page or in shelf search opens `/items/:id`.
2. The book page shows saves and the average rating, your status, your shelves with their edition counts, and the details.
3. The Log button with no status adds "Want to read". With a status, it opens the menu. The menu changes the status, removes it from the Log, and opens Add to shelf.
4. Marking it read with no rating opens the review sheet.
5. Add to shelf starts on a shelf that already holds the book. Switching shelves updates which editions are checked. Owned editions are listed first.
6. Typing in the filter narrows the list by ISBN, publisher or title. Typing a full ISBN that isn't listed shows "Add this edition". It joins as unreviewed and lands on the shelf.
7. The scan button opens the camera in the dialog. A scan fills in the filter.
8. A brand new account with no shelves can name a first shelf right in the dialog.
9. The Editions tab pages through editions and marks each with the shelves that own it, plus "Unreviewed" on pending ones.
10. The Reviews tab shows your review and everyone else's.
11. The series link on a book opens `/series/:id`. It shows the lowest volume's cover, the AniList details, your owned and read counts, and every volume with Owned and status marks.
12. A friend's shelf links to the same book page, and it shows your own status there, not theirs.
13. The shelf scan page still scans like before.

## Not now

- Comparing with friends on the book page.
- Bulk actions on series, like marking 1–12 read.
- Past searches and a full results page.
- Renaming ISBN to barcode in code for music. The UI says "edition" already.
- Renaming `collection` to `shelf` in code.
