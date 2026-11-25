// *********************************************************************
// Tekst Uputstva (sr / en). Slike: client/public/guide-shots/<jezik>/<img>.webp –
// prave se komandom  npm run guide:screens  (vidi scripts/guide-screens.mjs).
// html je naš sopstveni tekst (ne unos korisnika), pa se prikazuje kao HTML.
// *********************************************************************
export const GUIDE = {
    sr: [
        {
            id: 'start', title: 'Prvi koraci', img: 'dashboard',
            caption: 'Pregled: brojevi, poslednje dodate komponente, šta treba dopuniti i poslednje promene stanja.',
            html: `
<p>Component Tracker vodi evidenciju elektronskih komponenti u radionici: <b>šta imaš, koliko i gde</b>.
Radi na tvom računaru, a podaci se čuvaju samo kod tebe – nema naloga ni oblaka.</p>
<ul>
<li><b>Pregled</b> je početni ekran: koliko komponenti i komada imaš, šta je pri kraju i šta se poslednje menjalo. Klik na bilo koji broj otvara listu.</li>
<li>U meniju levo su <b>Komponente</b>, <b>Lokacije</b>, <b>Kategorije</b>, <b>Kanta</b> i <b>Podešavanja</b>.</li>
<li>Gore levo menjaš <b>temu</b> (svetla / tamna) i <b>jezik</b> (srpski / engleski).</li>
</ul>
<p class="tip">Savet: najlakši početak je da napraviš lokacije (ormar, fioke, kutije), pa da dodaješ komponente –
ili da uvezeš listu koju već imaš u Excel-u (poglavlje <a href="#import">Uvoz iz Excel-a</a>).</p>`
        },
        {
            id: 'add', title: 'Dodavanje komponente', img: 'component',
            caption: 'Panel komponente: podaci, stanje po lokacijama, opis i beleške.',
            html: `
<p>Klikni <b>+ Nova komponenta</b>. Otvara se panel sa desne strane:</p>
<ul>
<li><b>Naziv</b> je jedino obavezno polje. MPN (oznaka proizvođača) je važan ako hoćeš da koristiš pretragu online.</li>
<li><b>Kategorija</b> i <b>lokacija</b> se biraju sa liste ili upisuju – nova se napravi sama
(upis „Ormar A › Fioka 4” napravi i ormar i fioku).</li>
<li><b>Stanje po lokacijama</b>: ista komponenta može biti na više mesta – <b>+ Dodaj lokaciju</b>.</li>
<li><b>Minimalno stanje</b>: kad količina padne na tu vrednost, komponenta se označi kao „Malo” i pojavi na Pregledu.</li>
<li><b>Sačuvaj</b> (ili <kbd>Ctrl</kbd>+<kbd>S</kbd>).</li>
</ul>
<p>Ako MPN već postoji u inventaru, aplikacija to kaže i nudi da samo dodaš količinu postojećoj.</p>
<p><b>Kopiraj kao novu</b> (dole u panelu) pravi novu komponentu sa istim podacima, bez MPN-a i količine –
zgodno za drugu vrednost iste serije (npr. 4k7 posle 10k otpornika).</p>
<p>Kartica <b>Istorija</b> prikazuje svaku promenu stanja: šta je dodato, premešteno, obrisano ili vraćeno iz kante.</p>`,
            extraImg: 'history', extraCaption: 'Istorija komponente: svaka promena stanja sa vremenom i lokacijom.'
        },
        {
            id: 'lookup', title: 'Pronađi online (Mouser / Element14)', img: 'lookup',
            caption: 'Rezultati pretrage: varijante istog dela grupisane po porodici, sa stanjem kod oba distributera.',
            html: `
<p>Dugme <b>Pronađi online</b> u panelu komponente pretražuje kataloge Mouser-a i Element14 po MPN-u ili nazivu
i popunjava proizvođača, kućište, opis, sliku i datasheet.</p>
<ul>
<li>Za ovo je potreban <b>besplatan API ključ</b> kod bar jednog distributera – upisuje se u
<a href="#settings">Podešavanjima</a>. Bez ključa aplikacija radi normalno, samo bez ove pretrage.</li>
<li>Varijante istog dela (npr. različito kućište ili pakovanje) su grupisane, a „Imaš N kom” pokazuje šta već imaš.</li>
<li>Klik na red pa izbor polja: štikliraš šta da se upiše. Za svako polje možeš da izabereš izvor (Mouser ili Element14).</li>
</ul>`
        },
        {
            id: 'list', title: 'Lista komponenti, pretraga i filteri', img: 'components',
            caption: 'Lista komponenti: filteri levo, brza promena stanja sa − i +.',
            html: `
<ul>
<li><b>Pretraga</b> traži po nazivu, MPN-u, kućištu, lokaciji i opisu – može više reči odjednom (npr. „mosfet to-220”).
<kbd>Esc</kbd> ili × briše pretragu.</li>
<li><b>Filteri</b> levo: stanje (malo / nema), kategorije i lokacije. Broj pored svake stavke kaže koliko komponenti ima.</li>
<li><b>− i +</b> pored količine menjaju stanje odmah (sa <kbd>Shift</kbd> za 10 komada). Svaka promena ide u istoriju.</li>
<li>Klik na naslov kolone sortira. Broj redova i sortiranje se pamte.</li>
<li>Štikliraj više komponenti za <b>masovne akcije</b>: premeštanje na drugu lokaciju, promena kategorije ili brisanje.</li>
<li><b>Izvoz</b>: CSV (za Excel) ili tekstualna lista – izvozi se ono što je trenutno prikazano.</li>
</ul>`
        },
        {
            id: 'filters', title: 'Oznake filtera', img: 'filters',
            caption: 'Uključeni filteri su prikazani iznad tabele – × skida jedan, „Poništi sve” sve.',
            html: `
<p>Svaki uključen filter se vidi kao oznaka iznad tabele, pa je uvek jasno zašto je lista kraća.
Klik na oznaku skida taj filter. Filteri su i u adresi stranice, pa se takav prikaz može sačuvati kao obeleživač.</p>`
        },
        {
            id: 'locations', title: 'Lokacije', img: 'locations',
            caption: 'Lokacije su stablo: ormar › fioka › kutija, sa brojem komponenti i komada.',
            html: `
<ul>
<li>Lokacije mogu biti jedna u drugoj: <b>Ormar › Fioka › Kutija</b>. Novu podlokaciju dodaješ dugmetom <b>+</b> u redu.</li>
<li>Klik na naziv lokacije otvara listu komponenti u njoj (zajedno sa podlokacijama).</li>
<li>Brisanje lokacije ne gubi ništa: podlokacije i komadi prelaze na nadređenu lokaciju, a sve se može vratiti iz <a href="#trash">Kante</a>.</li>
</ul>`
        },
        {
            id: 'qr', title: 'Telefon i QR nalepnice', img: 'qr',
            caption: 'Štampa QR nalepnica – adresa mora biti adresa računara u lokalnoj mreži.',
            html: `
<p>Aplikaciju možeš da otvoriš i sa <b>telefona u istoj Wi-Fi mreži</b>: u pregledaču telefona upiši adresu računara,
npr. <code>http://192.168.1.10:3000</code> (tačnu adresu vidiš u dijalogu za štampu QR nalepnica).</p>
<ul>
<li>Na ekranu <b>Lokacije</b> klikni ikonu <b>QR</b> u redu lokacije – ili štikliraj više lokacija i klikni <b>QR nalepnice (n)</b>.</li>
<li>Proveri adresu (ne sme biti „localhost”) i klikni <b>Štampaj</b>.</li>
<li>Nalepi nalepnicu na kutiju. Kad je skeniraš telefonom, odmah vidiš šta je u njoj i možeš da menjaš količine.</li>
</ul>`,
            extraImg: 'phone', extraPhone: true, extraCaption: 'Na telefonu: komponente u jednoj fioci, otvorene skeniranjem QR nalepnice.'
        },
        {
            id: 'import', title: 'Uvoz iz Excel-a', img: 'import',
            caption: 'Uvoz: kolone su prepoznate same, a pregled pokazuje šta je novo i šta već postoji.',
            html: `
<ol>
<li>U Excel-u: <b>Datoteka → Sačuvaj kao → CSV</b>. Prvi red treba da ima nazive kolona (Naziv, MPN, Lokacija, Količina…).</li>
<li>Na listi komponenti klikni <b>Uvoz</b> i izaberi fajl. Kolone se prepoznaju same; ako neka nije, izaberi je ručno.</li>
<li>Pregled pokazuje za svaki red: <b>Nova</b>, <b>Već postoji</b> ili <b>Nema naziv</b>. Za postojeće biraš da li da se preskoče ili da im se doda količina.</li>
<li>Klikni <b>Uvezi</b>. Kategorije i lokacije koje ne postoje prave se same.</li>
</ol>
<p class="tip">Ne znaš kako da složiš tabelu? U dijalogu klikni <b>Preuzmi primer fajla</b> i popuni ga.</p>`
        },
        {
            id: 'trash', title: 'Kanta', img: 'trash',
            caption: 'Kanta: obrisane komponente i lokacije čekaju dok je ne isprazniš.',
            html: `
<p>Ništa se ne briše odmah. Obrisane komponente, lokacije i kategorije idu u <b>Kantu</b>, gde čekaju dok je sam ne isprazniš.</p>
<ul>
<li>Odmah posle brisanja pojavi se poruka sa dugmetom <b>Poništi</b>.</li>
<li>U Kanti: <b>Vrati</b> vraća stavku sa svim što joj pripada (stanje, istoriju, podlokacije, komponente kategorije),
a <b>Obriši trajno</b> je briše zauvek. Oba traže potvrdu.</li>
</ul>`
        },
        {
            id: 'settings', title: 'Podešavanja i backup', img: 'settings',
            caption: 'Podešavanja: izgled, API ključevi, lokalni fajlovi, backup i ažuriranja.',
            html: `
<ul>
<li><b>Izgled</b>: tema, veličina slova i jezik.</li>
<li><b>API servisi</b>: ključ za Mouser i/ili Element14 (besplatna registracija na njihovom sajtu – linkovi su tu).
<b>Glavni izvor</b> određuje čiji se podaci uzimaju kad isti deo postoji kod oba.</li>
<li><b>Lokalni fajlovi</b>: slike se čuvaju na računaru, pa rade i bez interneta. Datasheet možeš sačuvati dugmetom pored linka.</li>
<li><b>Backup</b>: <b>Napravi backup</b> pravi kompletnu kopiju baze koju možeš i da preuzmeš. Pravi ga redovno i čuvaj i van računara.</li>
<li><b>O aplikaciji</b>: verzija, folder sa podacima i provera da li postoji nova verzija.</li>
</ul>
<p class="tip">Nova verzija se instalira isto kao prva – pokreneš novi setup preko stare. Podaci ostaju, a baza se pre toga sama kopira u backup.</p>`
        }
    ],
    en: [
        {
            id: 'start', title: 'Getting started', img: 'dashboard',
            caption: 'Dashboard: totals, recently added components, what needs restocking and recent stock changes.',
            html: `
<p>Component Tracker keeps track of the electronic components in your workshop: <b>what you have, how many and where</b>.
It runs on your computer and the data stays with you – no account, no cloud.</p>
<ul>
<li><b>Dashboard</b> is the start screen: how many components and pieces you have, what is running low and what changed last. Click any number to open the list.</li>
<li>The menu on the left has <b>Components</b>, <b>Locations</b>, <b>Categories</b>, <b>Trash</b> and <b>Settings</b>.</li>
<li>At the top left you switch the <b>theme</b> (light / dark) and <b>language</b> (Serbian / English).</li>
</ul>
<p class="tip">Tip: the easiest start is to create your locations (cabinet, drawers, boxes) and then add components –
or import a list you already have in Excel (see <a href="#import">Import from Excel</a>).</p>`
        },
        {
            id: 'add', title: 'Adding a component', img: 'component',
            caption: 'Component panel: details, stock per location, description and notes.',
            html: `
<p>Click <b>+ New component</b>. A panel opens on the right:</p>
<ul>
<li><b>Name</b> is the only required field. The MPN (manufacturer part number) matters if you want to use online lookup.</li>
<li><b>Category</b> and <b>location</b> can be picked from the list or typed – a new one is created automatically
(typing "Cabinet A › Drawer 4" creates both the cabinet and the drawer).</li>
<li><b>Stock by location</b>: the same component can be in several places – <b>+ Add location</b>.</li>
<li><b>Minimum stock</b>: when the quantity drops to this value, the component is marked "Low" and shown on the Dashboard.</li>
<li><b>Save</b> (or <kbd>Ctrl</kbd>+<kbd>S</kbd>).</li>
</ul>
<p>If the MPN is already in your inventory, the app tells you and offers to just add the quantity to the existing one.</p>
<p><b>Copy as new</b> (at the bottom of the panel) creates a new component with the same details, without the MPN and quantity –
handy for another value of the same series (e.g. 4k7 after a 10k resistor).</p>
<p>The <b>History</b> tab shows every stock change: what was added, moved, deleted or restored from the trash.</p>`,
            extraImg: 'history', extraCaption: 'Component history: every stock change with its time and location.'
        },
        {
            id: 'lookup', title: 'Find online (Mouser / Element14)', img: 'lookup',
            caption: 'Lookup results: variants of the same part grouped by family, with stock at both distributors.',
            html: `
<p>The <b>Find online</b> button in the component panel searches the Mouser and Element14 catalogs by MPN or name
and fills in the manufacturer, package, description, image and datasheet.</p>
<ul>
<li>This needs a <b>free API key</b> from at least one distributor – enter it in <a href="#settings">Settings</a>.
Without a key the app works normally, just without this lookup.</li>
<li>Variants of the same part (e.g. a different package or packaging) are grouped, and "You have N pcs" shows what you already own.</li>
<li>Click a row, then tick the fields to fill in. For each field you can choose the source (Mouser or Element14).</li>
</ul>`
        },
        {
            id: 'list', title: 'Component list, search and filters', img: 'components',
            caption: 'Component list: filters on the left, quick stock changes with − and +.',
            html: `
<ul>
<li><b>Search</b> looks in the name, MPN, package, location and description – several words at once work (e.g. "mosfet to-220").
<kbd>Esc</kbd> or × clears the search.</li>
<li><b>Filters</b> on the left: stock (low / out), categories and locations. The number next to each item tells how many components it has.</li>
<li><b>− and +</b> next to the quantity change the stock immediately (with <kbd>Shift</kbd> by 10). Every change goes into the history.</li>
<li>Click a column header to sort. Rows per page and sorting are remembered.</li>
<li>Tick several components for <b>bulk actions</b>: move to another location, change category or delete.</li>
<li><b>Export</b>: CSV (for Excel) or a text list – what is currently shown gets exported.</li>
</ul>`
        },
        {
            id: 'filters', title: 'Filter chips', img: 'filters',
            caption: 'Active filters are shown above the table – × removes one, "Clear all" removes all.',
            html: `
<p>Every active filter is shown as a chip above the table, so it is always clear why the list is shorter.
Click a chip to remove that filter. Filters are also in the page address, so such a view can be saved as a bookmark.</p>`
        },
        {
            id: 'locations', title: 'Locations', img: 'locations',
            caption: 'Locations form a tree: cabinet › drawer › box, with the number of components and pieces.',
            html: `
<ul>
<li>Locations can be nested: <b>Cabinet › Drawer › Box</b>. Add a sublocation with the <b>+</b> button in its row.</li>
<li>Click a location name to open the list of components in it (including sublocations).</li>
<li>Deleting a location loses nothing: sublocations and pieces move to the parent location, and everything can be restored from the <a href="#trash">Trash</a>.</li>
</ul>`
        },
        {
            id: 'qr', title: 'Phone and QR labels', img: 'qr',
            caption: 'Printing QR labels – the address must be the computer\'s address on the local network.',
            html: `
<p>You can also open the app from a <b>phone on the same Wi-Fi network</b>: in the phone's browser enter the computer's address,
e.g. <code>http://192.168.1.10:3000</code> (the exact address is shown in the QR label print dialog).</p>
<ul>
<li>On the <b>Locations</b> screen click the <b>QR</b> icon in a location's row – or tick several locations and click <b>QR labels (n)</b>.</li>
<li>Check the address (it must not be "localhost") and click <b>Print</b>.</li>
<li>Stick the label on the box. Scan it with your phone to see what is inside and change quantities right away.</li>
</ul>`,
            extraImg: 'phone', extraPhone: true, extraCaption: 'On a phone: components in one drawer, opened by scanning its QR label.'
        },
        {
            id: 'import', title: 'Import from Excel', img: 'import',
            caption: 'Import: columns are detected automatically, and the preview shows what is new and what already exists.',
            html: `
<ol>
<li>In Excel: <b>File → Save As → CSV</b>. The first row should have column names (Name, MPN, Location, Quantity…).</li>
<li>On the component list click <b>Import</b> and choose the file. Columns are detected automatically; if one is not, pick it by hand.</li>
<li>The preview shows for each row: <b>New</b>, <b>Already exists</b> or <b>No name</b>. For existing ones you choose whether to skip them or add their quantity.</li>
<li>Click <b>Import</b>. Categories and locations that do not exist are created automatically.</li>
</ol>
<p class="tip">Not sure how to lay out the table? In the dialog click <b>Download a sample file</b> and fill it in.</p>`
        },
        {
            id: 'trash', title: 'Trash', img: 'trash',
            caption: 'Trash: deleted components and locations wait here until you empty it.',
            html: `
<p>Nothing is deleted right away. Deleted components, locations and categories go to the <b>Trash</b>, where they wait until you empty it.</p>
<ul>
<li>Right after deleting, a message with an <b>Undo</b> button appears.</li>
<li>In the Trash: <b>Restore</b> brings an item back with everything that belongs to it (stock, history, sublocations, the category's components),
and <b>Delete permanently</b> removes it for good. Both ask for confirmation.</li>
</ul>`
        },
        {
            id: 'settings', title: 'Settings and backup', img: 'settings',
            caption: 'Settings: appearance, API keys, local files, backup and updates.',
            html: `
<ul>
<li><b>Appearance</b>: theme, text size and language.</li>
<li><b>API services</b>: a key for Mouser and/or Element14 (free registration on their website – the links are there).
The <b>primary source</b> decides whose data is used when the same part exists at both.</li>
<li><b>Local files</b>: images are stored on the computer, so they work without internet. You can save a datasheet with the button next to its link.</li>
<li><b>Backup</b>: <b>Create backup</b> makes a complete copy of the database that you can also download. Make one regularly and keep a copy off the computer.</li>
<li><b>About</b>: version, data folder and a check for a new version.</li>
</ul>
<p class="tip">A new version is installed the same way as the first one – run the new setup over the old one. Your data stays, and the database is copied to a backup first.</p>`
        }
    ]
};
