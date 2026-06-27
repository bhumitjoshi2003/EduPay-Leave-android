# Report Card Design Prompt — Edunexify Platform

## What You Are Designing

An **official school report card document** for **Edunexify** — a multi-tenant SaaS school management platform serving Indian schools (CBSE, ICSE, State Board). The report card exists in two identical forms:

1. **Web view** — rendered in Angular 19, viewed on desktop and mobile browsers
2. **PDF download** — generated server-side using OpenPDF (iText 4 fork), A4 paper, printed and distributed to parents/students

Both must look **identical**. Design decisions must work in both CSS (screen + print) and a Java PDF library.

---

## Who Uses This Document

| Audience | Use |
|---|---|
| **School admin** | Configures the template, publishes report cards |
| **Teacher** | Enters marks, remarks; views the output |
| **Student** | Views their own report card on the app |
| **Parent** | Receives the printed/PDF copy at school or via WhatsApp/email |
| **Inspector / auditor** | Reviews for compliance during school inspections |

**The parent + student + inspector are the primary visual audience.** This is an official document they file, frame, or submit to other schools on transfers. It must look authoritative, serious, and complete — not like a dashboard widget.

---

## Current Structure (Section-by-Section)

The report card is built from **template sections** that the admin can individually enable/disable and reorder. The default enabled order is:

### 1. SCHOOL_HEADER
**Purpose:** School identity — who issued this document.

**Two modes:**
- **Custom header image** — school uploads a full-width banner image (e.g., professionally designed letterhead with logo, name, affiliation, address, phone, website all in their own typography/layout). Max height ~150px. This completely replaces the auto-generated header.
- **Auto-generated header** — system builds it from school settings data: circular logo (left), school name + board label + affiliation number + address + phone + email (center). No right column (was removed in favor of the title band below).

**Data available:** schoolName, schoolLogoUrl, schoolAddress, schoolPhone, schoolEmail, boardType (CBSE/ICSE/STATE/IB/IGCSE/OTHER), affiliationNumber

**Current CSS classes:** `.rc-school-header`, `.rc-header-inner`, `.rc-header-logo`, `.rc-header-center`, `.rc-school-name`, `.rc-school-board-label`, `.rc-school-detail`, `.rc-school-logo`

---

### 2. DOCUMENT TITLE BAND *(always rendered inside SCHOOL_HEADER section, not configurable)*
**Purpose:** Clearly identifies this as an official "REPORT CARD" — the most important missing piece before this was added.

**Content:**
- Line 1: **"REPORT CARD"** — 13–15pt, bold, 5–6px letter-spacing, white text on primary color background
- Line 2: `Academic Session: 2026-2027 • Half Yearly` — 7.5–8pt, 88% opacity white

**Data:** `session` (e.g., "2026-2027"), `weightedResult.groupName` (e.g., "Half Yearly", "Annual Examination", "Unit Test 1")

**Current CSS:** `.rc-doc-title-band`, `.rc-doc-title-label`, `.rc-doc-title-meta`

**Current PDF:** Full-width `PdfPTable` with `branding.primary` background, white text.

---

### 3. STUDENT_INFO
**Purpose:** Uniquely identify the student this report card belongs to.

**Layout:** 5-column table. Columns: [Label | Value | Label | Value | Photo]. Photo cell spans 4 rows. If no photo uploaded, shows an empty passport-size dashed rectangle (placeholder).

**Data:**
- studentName, className, sectionName (e.g. "10 – A")
- studentId (used as Admission No.)
- session
- dateOfBirth
- fatherName, motherName
- photoUrl (relative path like `/uploads/student-photos/S102.jpg`)

**Current CSS:** `.rc-student-table`, `.rc-si-label` (uppercase label in background tint), `.rc-si-value`, `.rc-si-photo`, `.rc-student-photo` (66×84px), `.rc-photo-placeholder`

---

### 4. MARKS_TABLE
**Purpose:** The core academic performance data.

**Layout:** Table with columns: [Subject | Exam1 | Exam2 ... | Grade]. One row per subject the student is enrolled in. A TOTAL row at the bottom.

**Data structure:**
- `weightedResult.marksTable.examColumns[]` — list of exam names + weightage (e.g., "Half Yearly (100%)")
- `weightedResult.marksTable.subjectRows[]` — per subject: subjectName, marks per exam (obtained/max), weightedPercentage, grade
- `weightedResult.marksTable.examTotals[]` — total obtained/max per exam column
- Failed subjects (weightedPercentage < 33) are shown in dark red italic

**Grading systems** (school-configurable):
- **CBSE**: A1 (91–100 Outstanding), A2 (81–90 Excellent), B1 (71–80 Very Good), B2 (61–70 Good), C1 (51–60 Satisfactory), C2 (41–50 Average), D (33–40 Needs Improvement), E (0–32 Fail)
- **LETTER**: A+ (≥90), A (≥80), B+ (≥70), B (≥60), C+ (≥50), C (≥40), D (≥33), F (<33)
- **PERCENTAGE**: no grade column, just numbers

**Grade legend** appears below the table (only for CBSE and LETTER grading systems).

**Current CSS:** `.rc-table`, `.rc-th-subject`, `.rc-th-exam`, `.rc-th-grade`, `.rc-row-fail` (dark red italic), `.rc-grade-legend`, `.rc-tfoot-row`

---

### 5. ASSESSMENT_SUMMARY
**Purpose:** Give the overall picture in one row.

**Content:** Overall Percentage | Grade | Class Rank | CGPA (CBSE only)

**Data:** `weightedResult.weightedPercentage`, `overallGrade`, `weightedResult.rank`, `cgpa`

**Note:** CGPA only shown when grading system is CBSE and admin enables it via branding config.

---

### 6. ATTENDANCE *(optional — admin can disable)*
**Purpose:** Show the student's attendance record for the session.

**Data:** workingDays, presentDays, percentage

**Layout:** Simple 3-column summary row (Working Days | Present Days | Attendance %).

---

### 7. CO_SCHOLASTIC *(optional — admin can disable)*
**Purpose:** Grades for non-academic activities (Art, Sports, Music, etc.)

**Data:** list of `{ activity: string, grade: string | null }` — activities are defined by the school in the assessment group config.

**Layout:** 2-column table (Activity | Grade).

---

### 8. TEACHER_REMARKS *(optional — admin can disable)*
**Purpose:** Class teacher's written remarks about the student.

**Data:** `teacherRemarks` — free text string, entered per student per session.

**Layout:** Section title + bordered text box (minimum 40px tall, expands with content). No signature line (was removed — signatures are already in the SIGNATURES section).

---

### 9. PRINCIPAL_REMARKS *(optional — admin can disable)*
**Purpose:** Principal's written remarks.

**Same layout as teacher remarks.**

---

### 10. PROMOTION_STATUS *(optional — admin can disable)*
**Purpose:** The final verdict on the student's performance.

**Layout:** A centered bordered stamp-style box.
- **PASS** (≥33%): large bold green "PASS", percentage + grade below
- **FAIL** (<33%): large bold dark-red "FAIL", percentage + grade below

**Current CSS:** `.rc-result-stamp-wrap`, `.rc-result-stamp`, `.rc-result-pass` (green border), `.rc-result-fail` (dark-red border), `.rc-result-verdict` (18pt, letter-spacing 5px), `.rc-result-meta`

---

### 11. SIGNATURES
**Purpose:** Formal authentication of the document.

**Signatories:** Class Teacher, Principal (Parent/Guardian signature was removed — they sign a separate acknowledgement slip).

**Layout:** Two equally-spaced columns, each with a horizontal line above and label below.

---

### 12. Footer *(always shown, not a configurable section)*
**Content:** "powered by Edunexify" — small, centered, gray.

---

## What the School Can Configure

### Via School Settings (permanent school data)
| Setting | Effect |
|---|---|
| School Name | Used in auto-generated header |
| Logo | Used in auto-generated header + PDF watermark option |
| Board Type | CBSE / ICSE / STATE / IB / IGCSE / OTHER — shown as subtitle in header |
| Affiliation Number | Shown in header (e.g., "Affiliation No: 3530501") |
| Address, Phone, Email | Shown in auto-generated header |
| **Report Card Header Image** | Full-width banner upload — replaces the entire auto-generated header |
| Grading System | CBSE / LETTER / PERCENTAGE — affects marks table and legend |

### Via Template Branding Config (per report card template, stored as JSON)
| Setting | Effect |
|---|---|
| **Primary Color** | Hex color — used for all section title bars, document title band background, table header rows, result stamp border, PASS color, logo stripe |
| **Watermark** | Toggle on/off. Type: TEXT (faded diagonal text, 7% opacity, 45° angle) or LOGO (school logo centered, 12% opacity). If text, custom text or auto-use school name |
| **Footer Text** | Custom text in PDF footer (e.g. "This is a computer-generated document") |
| **Show CGPA** | Toggle CGPA column in Assessment Summary (CBSE only) |
| **Show Grade Points** | Toggle GP column in Marks Table |

### Via Template Section Config (per section)
Each section can be individually **enabled/disabled** and **reordered**.

---

## Design Constraints (Hard Rules)

1. **Print-first**: The document must print perfectly on A4. Avoid anything that depends on screen rendering (shadows, gradients, transparency inside the document).
2. **No border-radius** on any document element (tables, cells, the card itself). This is an official document, not a UI card.
3. **No box-shadow** on the printable area.
4. **No gradients inside the document** body (the toolbar/hero above is app chrome and hidden on print).
5. **Color-adjust**: All background colors in table headers and the title band must use `-webkit-print-color-adjust: exact` to print on all browsers/printers.
6. **Typography**: Currently uses system fonts (Segoe UI / sans-serif on screen, Times-Roman family in PDF). The PDF uses Times-Roman exclusively because it's a safe embedded font in OpenPDF.
7. **PDF mirroring**: Any CSS design must be translatable to OpenPDF `PdfPTable` + `PdfPCell` layout. Flexbox, Grid, CSS transforms are not available in the PDF.
8. **Multi-subject scaling**: Some students have 3 subjects, some have 12+. Tables must work at both extremes.
9. **Multi-exam columns**: The marks table can have 1 exam column ("Annual") or many (e.g., "Unit Test 1", "Unit Test 2", "Half Yearly", "Pre-Board"). Layout must handle up to ~5 columns without overflow.
10. **Multi-tenant**: The primary color is dynamic per school. Design must look good across all hue ranges (dark green, navy blue, maroon, dark teal, etc.).

---

## Current Visual Style Summary

- **Background**: White (`#fff`) document on gray (`#d0d0d0`) page tray
- **Primary color** (school-set, example: dark green `#145a14`):
  - All section title bars (full-width, colored background, white text, 7.5pt bold uppercase)
  - Document title band
  - Marks table header row
  - Assessment summary header row
  - Result stamp border + PASS text color
  - Top stripe of auto-generated school header
- **Typography scale** (pt units for print accuracy):
  - School name: 18pt bold
  - "REPORT CARD": 13–15pt bold, 5–6px letter-spacing
  - Section titles: 7.5pt bold uppercase
  - Table headers: 8pt bold
  - Table body: 8.5pt
  - Student info labels: 7.5pt uppercase
  - Detail text: 7–8pt
- **Table borders**: `1px solid #ccc` (light gray) inside, `1px solid #444` for outer card border
- **Label cells** in student info: slight gray background (`#fafafa`), uppercase, smaller font
- **Failed subject rows**: dark red (`#8b0000`) italic text
- **Grade colors**: primary color (green/blue) for passing grades, dark red for failing

---

## Current Gaps / Known Issues (Help Improve These)

1. **The document title band** was just added — it's functional but typographically basic. How can "REPORT CARD" and the session/term line be made more distinguished and official-looking while staying print-safe?

2. **Student info section** has the passport photo on the right but the placeholder (when no photo) is just a plain dashed rectangle — can it look more intentional?

3. **Result/Promotion stamp** is a bordered box with "PASS" — it works but feels generic. What would make it look more like an official school verdict?

4. **Section separators**: Currently each section has a full-width colored title bar. Is there a more sophisticated way to separate sections that still works in print?

5. **School header (auto-generated)**: When the school hasn't uploaded a custom header, the auto-generated one uses logo + text. How could this look more polished without depending on the school's design skills?

6. **White space and rhythm**: The document currently has tight spacing. What spacing rhythm would make it feel more like a premium school document?

7. **Watermark**: Currently either diagonal text at 7% opacity or school logo at 12% opacity centered. What opacity and placement would be optimal?

8. **Co-Scholastic section**: Currently a plain 2-column table. CBSE schools rate activities with grades (A/B/C) or descriptors (Excellent/Good/Satisfactory). How should this be visually differentiated from the academic marks table?

9. **Attendance section**: Currently shows 3 numbers. Could it include a simple visual (progress bar, arc) that's print-safe?

10. **Signatures section**: Two plain lines with labels. How can this feel more formal without becoming overly complex?

---

## Data Available (Full DTO Reference)

```
studentId          — e.g., "S102"
studentName        — e.g., "Himani"
className          — e.g., "2", "10", "12"
sectionName        — e.g., "A", "B" (may be null)
session            — e.g., "2026-2027"
dateOfBirth        — e.g., "29 Jun 2015"
fatherName         — may be null/blank
motherName         — may be null/blank
photoUrl           — relative path or null

schoolName         — e.g., "Indra Academy Senior Secondary School"
schoolLogoUrl      — relative path or null
schoolAddress      — e.g., "Vill- Dumkabangar Umpati, Halduchaur, Nainital"
schoolPhone        — e.g., "9756914629"
schoolEmail        — e.g., "indracademy@gmail.com"
boardType          — "CBSE" | "ICSE" | "STATE" | "IB" | "IGCSE" | "OTHER"
affiliationNumber  — e.g., "3530501" (may be null)
reportCardHeaderImageUrl — uploaded custom banner (may be null)

gradingSystem      — "CBSE" | "LETTER" | "PERCENTAGE"
overallGrade       — e.g., "A1", "A+", "87%"
cgpa               — e.g., 9.7 (null if non-CBSE or disabled)

weightedResult:
  groupName        — e.g., "Half Yearly", "Annual Examination"
  weightedPercentage — e.g., 93.33
  rank             — class rank (may be 0 if not computed)
  subjectResults[]:
    subjectName, weightedPercentage
  marksTable:
    examColumns[]: { examName, weightagePercent }
    subjectRows[]: { subjectName, marksByExam[]{obtained,max}, weightedPercentage, grade }
    examTotals[]: { obtained, max }

attendance:        — may be null
  workingDays, presentDays, percentage

coScholasticGrades[]: — may be null/empty
  { activity, grade }

teacherRemarks     — free text, may be null
principalRemarks   — free text, may be null

template:
  sections[]:      — ordered, each has sectionType + enabled flag
  brandingJson:    — { primaryColor, showWatermark, watermarkType, watermarkText,
                       footerText, showCgpa, showGradePoints }

verificationToken  — for QR code / authenticity verification (future)
```

---

## Technical Stack Summary

**Frontend:** Angular 19 (standalone components), `ChangeDetectionStrategy.OnPush`, no NgRx. CSS is print-first. `@media print` hides all app chrome (toolbar, buttons, background).

**Backend PDF:** Java Spring Boot, OpenPDF 1.3.11 (open-source iText 4 fork). Uses `PdfPTable` / `PdfPCell` for all layout. Fonts: `FontFactory.TIMES_ROMAN`, `FontFactory.TIMES_BOLD`. Colors: `java.awt.Color`. Page size: A4 (595×842pt), margins 39.7pt left/right, 34pt top/bottom.

**Multi-tenancy:** Each school is isolated. `schoolId` is injected on every query. The report card template is per-school.

**Deployment:** `https://edunexify.co.in` — Indian schools, Hindi/English bilingual student names, mostly printed and handed to parents.

---

## Reference Screenshot Description

The screenshot shows Indra Academy's report card with:
- Custom header image uploaded (their professional letterhead design with circular crest logo, school name in teal, CBSE affiliation, address with location icon, email+website+phone)
- Dark green primary color (`~#145a14`)
- The new "REPORT CARD / Academic Session: 2026-2027 • Half Yearly" title band in dark green
- Student: Himani, Class 2, Session 2026-2027
- Subjects: Computer (78/80, A1), GK (71/80, A2), Mathematics (75/80, A1) — Total 224/240, A1
- Logo watermark visible behind the marks table (school crest at ~12% opacity)
- Assessment summary: 93.3%, A1, CGPA 9.7
- Result: PASS stamp (93.3% • A1)

---

## What We Want From You

Please suggest specific, implementable design improvements for this report card that:

1. Make it look more **official, trustworthy, and premium** — something a parent would be proud to receive
2. Improve **visual hierarchy** so the most important information (student name, result, grades) is immediately obvious
3. Improve **section organization** — should sections be separated differently? Should any sections be combined?
4. Suggest a better **typography system** — what font sizes, weights, and spacing rhythm would work for an A4 printed document?
5. Suggest improvements to the **Result/PASS-FAIL stamp** — it should feel like an official school decision, not a UI badge
6. Suggest how to make the **document title band** more distinguished
7. Suggest any **structural changes** — e.g., should the student photo be somewhere else? Should the school logo appear in the corner on every page for multi-page cards?
8. Consider **CBSE compliance** — CBSE report cards have specific formats (subject-wise grades, CGPA, co-scholastic, health & physical education). Suggest how the layout can be closer to the official CBSE format while still being clean.

For each suggestion, describe:
- What to change
- Why it would be better
- Any specific values (font sizes, spacing, color usage)
- Whether it requires only CSS changes or also structural/HTML changes
