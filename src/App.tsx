import "./App.css";

const features = [
  { icon: "📄", title: "Markdown local", desc: "Tus notas son archivos .md reales, sin base de datos." },
  { icon: "🔗", title: "Backlinks y wikilinks", desc: "Conecta notas con [[wikilinks]] y navega hacia atrás." },
  { icon: "🕸️", title: "Grafo visual", desc: "Explora relaciones entre notas en un grafo interactivo." },
  { icon: "🤖", title: "Memoria para Claude Code", desc: "El repositorio está diseñado para ser navegable por Claude." },
];

function App() {
  return (
    <main className="nw-container">
      <header className="nw-header">
        <h1 className="nw-title">Nebulosa Wiki</h1>
        <p className="nw-subtitle">Wiki Markdown local, portable y preparada para Claude Code.</p>
        <span className="nw-badge">MVP inicial en construcción</span>
      </header>

      <section className="nw-info">
        <span className="nw-info-label">Carpeta wiki</span>
        <code className="nw-path">D:\NebulosaWiki</code>
      </section>

      <section className="nw-grid">
        {features.map((f) => (
          <div className="nw-card" key={f.title}>
            <span className="nw-card-icon">{f.icon}</span>
            <h2 className="nw-card-title">{f.title}</h2>
            <p className="nw-card-desc">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

export default App;
