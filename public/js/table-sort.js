/**
 * Inicijalizacija sortiranja kada se DOM učita
 * - tražimo samo <th> koji imaju data-sort atribut
 * - index kolone dobijamo iz redosleda <th> elemenata
 */
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("table thead th").forEach((th, index) => {

        // Ako kolona nema data-sort → preskačemo je
        if (!th.dataset.sort) return;

        // Vizuelni hint korisniku da je klikabilno
        th.style.cursor = "pointer";

        th.addEventListener("click", () => {
            const table = th.closest("table"); // omogućava reuse JS-a za više tabela
            sortTable(table, index, th.dataset.sort, th);
        });
    });
});

/**
 * Vraća tekstualnu vrednost ćelije
 * - trim() skida praznine sa početka i kraja
 * - replace(/\s+/g, " ") normalizuje višestruke razmake
 *
 * Ovo je bitno jer:
 * - ćelije često sadrže <a>, <span>, <br>
 * - innerText vraća "prljav" tekst bez ove normalizacije
 */
function getCellValue(cell) {
    return cell.innerText.trim().replace(/\s+/g, " ");
}

/**
 * Glavna funkcija za sortiranje tabele
 */
function sortTable(table, column, type, header) {
    const tbody = table.querySelector("tbody");

    // Pretvaramo NodeList u pravi Array da bismo mogli da koristimo .sort()
    const rows = Array.from(tbody.querySelectorAll("tr"));

    /**
     * Toggle smera sortiranja:
     * - ako je prethodno bilo asc → desc
     * - u suprotnom → asc
     *
     * Ovo se čuva direktno u HTML-u (data-order),
     * što je jednostavno i vrlo praktično.
     */
    const order = header.dataset.order === "asc" ? "desc" : "asc";
    header.dataset.order = order;

    /**
     * 🔽 RESET SORT INDIKATORA
     * Pre nego što postavimo strelicu na aktivnu kolonu,
     * moramo očistiti sve ostale <th>
     */
    table.querySelectorAll("th[data-sort]").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
    });

    /**
     * 🔼 POSTAVI STRELICU NA AKTIVNU KOLONU
     * CSS klase kontrolišu prikaz ▲ ili ▼
     */
    header.classList.add(order === "asc" ? "sort-asc" : "sort-desc");

    /**
     * Sam algoritam sortiranja
     */
    rows.sort((a, b) => {
        let A = getCellValue(a.children[column]);
        let B = getCellValue(b.children[column]);

        // Ako je numerička kolona → parsiramo brojeve
        if (type === "number") {
            A = parseFloat(A) || 0;
            B = parseFloat(B) || 0;
        }

        if (A < B) return order === "asc" ? -1 : 1;
        if (A > B) return order === "asc" ? 1 : -1;
        return 0;
    });

    /**
     * Ponovno ubacivanje redova u tbody
     * (DOM operacije radimo jednom – efikasno)
     */
    tbody.innerHTML = "";
    rows.forEach(row => tbody.appendChild(row));
}
