import { useMemo, useState } from "react";
import catalogJson from "./data/catalog.json";
import type { PublicCatalog, PublicMedia, PublicPost, PublicVenue } from "./types";

const catalog = catalogJson as PublicCatalog;

type VenueCard = {
  venue: PublicVenue;
  posts: PublicPost[];
  media: PublicMedia[];
  tags: string[];
};

function prettyTag(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Data non disponibile";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Data non disponibile"
    : new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" }).format(parsed);
}

export function App() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("tutte");
  const [tag, setTag] = useState("tutti");
  const [visible, setVisible] = useState(12);

  const cards = useMemo(() => {
    const venueById = new Map(catalog.venues.map((venue) => [venue.id, venue]));
    const postById = new Map(catalog.posts.map((post) => [post.id, post]));
    const grouped = new Map<string, VenueCard>();
    for (const listing of catalog.listings) {
      const venue = venueById.get(listing.venueId);
      const post = postById.get(listing.postId);
      if (!venue || !post) continue;
      const current = grouped.get(venue.id) || { venue, posts: [], media: [], tags: [] };
      current.posts.push(post);
      current.media.push(...post.media);
      current.tags.push(...post.tags);
      grouped.set(venue.id, current);
    }
    return [...grouped.values()]
      .map((card) => ({ ...card, tags: [...new Set(card.tags)] }))
      .sort((left, right) => left.venue.name.localeCompare(right.venue.name, "it"));
  }, []);

  const cities = useMemo(
    () => [...new Set(catalog.venues.map((venue) => venue.city).filter(Boolean))].sort() as string[],
    [],
  );
  const tags = useMemo(
    () => [...new Set(catalog.posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, "it")),
    [],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return cards.filter((card) => {
      const text = [card.venue.name, card.venue.city, card.venue.neighbourhood, ...card.tags]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("it");
      return (!needle || text.includes(needle)) &&
        (city === "tutte" || card.venue.city === city) &&
        (tag === "tutti" || card.tags.includes(tag));
    });
  }, [cards, city, query, tag]);

  const reset = () => {
    setQuery("");
    setCity("tutte");
    setTag("tutti");
    setVisible(12);
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top"><span>A</span><strong>Aperitivi Urbani</strong></a>
        <nav aria-label="Navigazione principale">
          <a href="#catalogo">Catalogo</a>
          <a href="#metodo">Dati</a>
          <a href={catalog.creator.profileUrl} target="_blank" rel="noreferrer">@{catalog.creator.handle} ↗</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">Opzione 01 · Catalogo editoriale</p>
        <h1>La città<br /><em>nel bicchiere.</em></h1>
        <div className="hero-bottom">
          <p>Una guida pubblica, filtrabile e sempre collegata ai post originali. Foto e video dei record completi sono pubblicati con autorizzazione contrattuale creator.</p>
          <a className="button" href="#catalogo">Esplora i posti ↓</a>
        </div>
        <div className="metrics" aria-label="Copertura pubblicata">
          <span><strong>{catalog.coverage.completePosts}</strong> post completi</span>
          <span><strong>{catalog.coverage.venueCount}</strong> posti</span>
          <span><strong>{catalog.coverage.mediaCount}</strong> media</span>
          <span><strong>{catalog.coverage.excludedIncompleteRecords}</strong> incompleti esclusi</span>
        </div>
      </section>

      <section className="catalogue" id="catalogo">
        <div className="section-heading">
          <div><p className="eyebrow">Dal feed alla tavola</p><h2>Trova il prossimo brindisi.</h2></div>
          <p>{filtered.length} posti corrispondono ai filtri. Le coordinate mancanti non vengono indovinate.</p>
        </div>
        <div className="filters">
          <label><span>Cerca</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(12); }} placeholder="Nome, città, zona…" /></label>
          <label><span>Città</span><select value={city} onChange={(event) => { setCity(event.target.value); setVisible(12); }}><option value="tutte">Tutte</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Esperienza</span><select value={tag} onChange={(event) => { setTag(event.target.value); setVisible(12); }}><option value="tutti">Tutte</option>{tags.map((item) => <option key={item} value={item}>{prettyTag(item)}</option>)}</select></label>
          <button onClick={reset}>Azzera</button>
        </div>

        <div className="grid">
          {filtered.slice(0, visible).map((card, index) => (
            <article className="card" key={card.venue.id}>
              <div className="media-rail" aria-label={`${card.media.length} media per ${card.venue.name}`}>
                {card.media.map((media, mediaIndex) => (
                  <figure key={`${media.publicPath}-${mediaIndex}`}>
                    {media.contentType.startsWith("video/") || media.mediaType === "VIDEO" ? (
                      <video controls muted playsInline preload="none" src={media.publicPath} aria-label={media.altText || `Video di ${card.venue.name}`} />
                    ) : (
                      <img src={media.publicPath} alt={media.altText || card.venue.name} loading="lazy" decoding="async" />
                    )}
                    <figcaption>{mediaIndex + 1}/{card.media.length}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="card-body">
                <div className="card-kicker"><span>{String(index + 1).padStart(2, "0")}</span><span>{formatDate(card.posts[0]?.publishedAt || null)}</span></div>
                <h3>{card.venue.name}</h3>
                <p className="location">{[card.venue.neighbourhood, card.venue.city].filter(Boolean).join(" · ") || "Posizione non pubblicata"}</p>
                <p className="summary">{card.posts[0]?.summary || "Scopri il locale dal post originale."}</p>
                <div className="tags">{card.tags.slice(0, 5).map((item) => <span key={item}>{prettyTag(item)}</span>)}</div>
                <div className="sources">{card.posts.map((post, sourceIndex) => <a href={post.sourceUrl} target="_blank" rel="noreferrer" key={post.id}>Post {sourceIndex + 1} ↗</a>)}</div>
              </div>
            </article>
          ))}
        </div>
        {visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + 12)}>Mostra altri posti · {visible} di {filtered.length}</button>}
      </section>

      <section className="method" id="metodo">
        <p className="eyebrow">Copertura trasparente</p>
        <h2>588 record completi.<br />Nessuna falsa completezza.</h2>
        <div className="method-grid">
          <p><strong>615</strong> post tentati, senza elementi lasciati non tentati.</p>
          <p><strong>27</strong> record incompleti non alimentano questa guida.</p>
          <p><strong>2.366</strong> foto e video dei record completi, tutti inclusi.</p>
        </div>
      </section>

      <footer><span>Aperitivi Urbani · opzione catalogo</span><a href="https://github.com/stefanovaleri-svg/aperitivi-urbani-site-catalogue-public">Sorgente pubblica ↗</a></footer>
    </main>
  );
}
