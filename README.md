# 📚 Bookshelf Widget

A chic bookshelf on your iPhone home screen — real book spines and covers, no paid app required. Built with [Scriptable](https://scriptable.app). There's also a web version you can host for free and share with friends.

> **Add a screenshot here** → drop a photo of your widget into `screenshots/` and link it:
> `![Bookshelf widget](screenshots/widget.png)`

---

## ✨ What it does

- Renders a shelf of **3D book spines** on your home screen, with each spine's colour **sampled from the real cover**, the title and author set vertically, and a couple of books shown **face-out** with their real cover.
- Pulls **real covers** from Open Library (English editions), with Google Books as a fallback, and caches them so the widget stays fast.
- **Rotates** through your library on its own, or stays fixed — your choice. Rotation can cycle the whole shelf or **feature one author at a time**.
- An in-app **menu** (no code) to add, remove, reorder, mark books face-out, change a book's cover, sort, shuffle, or start from scratch.
- **Paste a whole list** at once (one book per line), or **import from Goodreads** via its shelf RSS feed — with optional **daily auto-sync**.
- Works in **medium** (one shelf) and **large** (two shelves) sizes.

## 📥 Install (Scriptable)

1. Install **Scriptable** (free) from the App Store.
2. Open Scriptable → **＋** (top right) → paste the full contents of [`bookshelf.js`](bookshelf.js) → name it **Bookshelf** → **Done**.
   - Or open `bookshelf.js`, tap **Share → Scriptable** to import it as a new script.
3. Run the script once (▶). A menu opens — add your books, or import from Goodreads.
4. On the home screen: long-press → **＋** → search **Scriptable** → pick **Medium** or **Large** → add it → long-press the widget → **Edit Widget** → choose the **Bookshelf** script.

The script ships with a small sample list; edit it from the menu.

## 🔄 Import from Goodreads

In the menu, tap **Importar de Goodreads** and paste your shelf's **RSS** link:

- On goodreads.com open your shelf (e.g. *Read*), scroll to the bottom and copy the orange **RSS** link.
- Your shelf must be **public**.
- Choose to replace or append, and optionally turn on **daily auto-sync**. Your manual tweaks (face-out books, custom covers) are preserved across syncs.

## 🌐 Web version

[`index.html`](index.html) is a standalone web bookshelf: a scrolling shelf of real covers, tap a book for the full cover, a cover editor, genre filters, and light/dark themes. Open it in any browser, or host it for free with **GitHub Pages** to get a shareable link:

**Settings → Pages → Source: `main` / root** → your site appears at `https://<your-username>.github.io/bookshelf-widget/`

Covers are fetched on the viewer's device from Open Library, so no build step or API key is needed.

## 🖼️ Where the data comes from

- Covers: [Open Library Covers](https://openlibrary.org/dev/docs/api/covers) (primary) and [Google Books](https://developers.google.com/books) (fallback).
- Goodreads import: public per-shelf **RSS** feeds.

This is a personal, non-commercial hobby project. All book covers and metadata belong to their respective owners.

## 🙏 Credits

- [Scriptable](https://scriptable.app) by Simon Støvring — the runtime that makes custom iOS widgets possible.
- The "sample the spine colour from the cover, draw a stylised 3D spine" idea was inspired by open-source virtual-bookshelf projects.
- Built with the help of Claude.

## 📄 License

MIT — see [LICENSE](LICENSE).
