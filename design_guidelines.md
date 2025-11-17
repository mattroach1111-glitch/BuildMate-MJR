# BuildFlow Pro - Search Filter Design Guidelines

## Design Approach
**System-Based Approach**: Following Radix UI component patterns with Tailwind utility classes. Construction management demands clarity and efficiency over visual flair.

## Core Design Principles
- **Mobile-First Priority**: Touch-friendly targets, thumb-zone optimization
- **Scan-First Design**: Quick visual parsing of job addresses and metadata
- **Context Preservation**: Always show user location within archived jobs flow

---

## Typography Hierarchy

**Search & Filter Context**
- Page Title: `text-2xl font-semibold` - "Archived Jobs"
- Result Count: `text-sm text-gray-600` - "23 jobs found"
- Job Address (Primary): `text-base font-medium` - Most prominent in results
- Job Metadata: `text-sm text-gray-500` - Secondary info (date archived, job ID)
- Empty State: `text-base text-gray-600` - Centered messaging

**Font Stack**: System fonts for performance (Inter or default sans-serif via Tailwind)

---

## Layout & Spacing System

**Spacing Scale**: Use Tailwind units of **4, 6, 8, 12, 16** for consistency
- Component padding: `p-4` (mobile), `p-6` (desktop)
- Section spacing: `gap-4` between elements
- Search bar margin: `mb-6` below header
- Result card spacing: `space-y-4` between job cards

**Container Structure**
- Max width: `max-w-4xl mx-auto` (desktop)
- Mobile: Full-width with `px-4` side padding
- Safe areas: Account for notches with `pt-safe-top`

---

## Component Design

### Search Bar Component
**Structure**: Sticky positioned below page header
- Height: `h-12` (48px - comfortable touch target)
- Background: White with subtle shadow `shadow-sm`
- Border: `border border-gray-200`
- Rounded: `rounded-lg`
- Icon: Leading magnifying glass icon (20px, gray-400)
- Input padding: `pl-12 pr-4` (space for icon + clear button)
- Placeholder: "Search by job address..."

**States**:
- Default: Gray border
- Focus: Blue ring `ring-2 ring-blue-500`, border-blue-500
- Filled: Show trailing X button (clear search)
- Error/No Results: Maintain normal appearance

### Job Result Cards
**Card Design**:
- Background: White
- Border: `border border-gray-100`
- Padding: `p-4`
- Rounded: `rounded-lg`
- Shadow: `shadow-sm` (subtle elevation)
- Hover: `border-gray-200` transition

**Card Content Layout**:
1. Job Address (bold, truncate with ellipsis if needed)
2. Job ID + Archive Date (horizontal flex, text-sm, gray-500)
3. Optional: Job type badge (if applicable)
4. Tap target: Full card clickable to view details

### Empty State
- Centered layout with search icon illustration
- Headline: "No jobs found"
- Subtext: "Try adjusting your search terms"
- Spacing: `py-16` vertical padding

### Filter Pills (If Multi-Filter)
Position above results, below search:
- Horizontal scroll on mobile `overflow-x-auto`
- Pill design: `px-4 py-2 rounded-full bg-gray-100`
- Active state: `bg-blue-100 text-blue-700`
- Clear all: Text button on right

---

## Mobile Optimization

**Touch Targets**: Minimum 44px height for all interactive elements
**Thumb Zone**: Place search bar in upper third (easy reach)
**Keyboard Handling**: 
- Input auto-focuses on page load (desktop only)
- Mobile: Virtual keyboard pushes content up, search stays visible
- Search triggers on typing (debounced 300ms)

**Performance**: Show loading skeleton during search (animated pulse on cards)

---

## Interaction Patterns

**Search Behavior**:
- Real-time filtering (no submit button needed)
- Debounce: 300ms delay after typing stops
- Case-insensitive matching
- Highlight matched text in results (optional enhancement)

**Result Sorting**: Default to most recently archived first

**Animations**: Minimal
- Search results: Subtle fade-in `transition-opacity duration-200`
- Card tap: Brief scale `active:scale-98`
- No elaborate scroll animations

---

## Images
**No images required** for this functional interface. Focus on clean typography and efficient information display.

---

## Accessibility
- Search input: Proper `aria-label="Search archived jobs by address"`
- Result count: `aria-live="polite"` region
- Keyboard navigation: Tab through results, Enter to select
- Focus visible states on all interactive elements