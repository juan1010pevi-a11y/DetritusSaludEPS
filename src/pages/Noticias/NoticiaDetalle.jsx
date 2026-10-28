import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import { getNews } from '../../services/api';
import './NoticiaDetalle.css';

export default function NoticiaDetalle() {
  const { id } = useParams();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNews()
      .then(data => setNews((data.items || []).find(item => String(item.id) === id) || null))
      .catch(() => setNews(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <section className="news-detail news-detail--state"><div className="container">Cargando noticia...</div></section>;
  }

  if (!news) {
    return (
      <section className="news-detail news-detail--state">
        <div className="container">
          <h1>Noticia no encontrada</h1>
          <Link className="btn btn--primary" to="/">Volver al inicio</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHero
        label={news.tag}
        title={news.title}
        description={news.body}
        image={news.image || '/img/atencion-usuario.jpg'}
        breadcrumb={[{ label: 'Inicio', path: '/' }, { label: 'Noticia' }]}
      />
      <article className="news-detail">
        <div className="container news-detail__layout">
          <div className="news-detail__content">
            <span className="section-label">{news.tag}</span>
            <h2>{news.title}</h2>
            <time>{news.publishedAt || 'Información reciente'}</time>
            <p>{news.body}</p>
            <p>Encuentra información, recomendaciones y servicios disponibles para cuidar tu salud junto a Detritus Salud E.P.S.</p>
            <Link className="btn btn--primary" to="/">Volver a noticias</Link>
          </div>
          <aside className="news-detail__aside">
            <span>Información y salud</span>
            <strong>Estamos para acompañarte</strong>
            <p>Consulta nuestros servicios y encuentra la atención que necesitas.</p>
            <Link to="/atencion">Contáctanos</Link>
          </aside>
        </div>
      </article>
    </>
  );
}
