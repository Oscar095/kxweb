import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';

export default function AboutPage() {
  return (
    <AnimatedPage>
      <Helmet>
        <title>Nosotros | KosXpress</title>
      </Helmet>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Sobre KosXpress</h1>

        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Quienes somos</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            KosXpress es una empresa colombiana dedicada a la comercializacion de
            empaques desechables y biodegradables para la industria de alimentos y
            bebidas. Desde nuestros inicios, nos hemos comprometido con ofrecer
            productos de alta calidad que se adaptan a las necesidades de
            restaurantes, cafeterias, servicios de catering y negocios de comida.
          </p>
          <p style={{ lineHeight: 1.7 }}>
            Contamos con una amplia linea de productos que incluye vasos, tapas,
            contenedores, platos, porta vasos, empaques para llevar y accesorios,
            todos disenados para brindar funcionalidad, buena presentacion y
            responsabilidad ambiental.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Mision</h3>
            <p style={{ lineHeight: 1.7, fontSize: '0.95rem' }}>
              Proveer soluciones en empaques desechables de excelente calidad,
              promoviendo opciones biodegradables y sostenibles que contribuyan
              al cuidado del medio ambiente, con entregas agiles en toda Colombia.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Vision</h3>
            <p style={{ lineHeight: 1.7, fontSize: '0.95rem' }}>
              Ser referentes en el mercado colombiano de empaques desechables y
              biodegradables, reconocidos por la calidad de nuestros productos,
              la innovacion en nuestras soluciones y el compromiso con la
              sostenibilidad ambiental.
            </p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Nuestros valores</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {[
              { title: 'Calidad', desc: 'Seleccionamos cuidadosamente cada producto para garantizar los mejores estandares.' },
              { title: 'Sostenibilidad', desc: 'Promovemos materiales biodegradables y opciones ecologicas para reducir el impacto ambiental.' },
              { title: 'Agilidad', desc: 'Optimizamos nuestros procesos para entregar tus pedidos en el menor tiempo posible.' },
              { title: 'Servicio', desc: 'Acompanamos a nuestros clientes con asesoria personalizada y atencion cercana.' },
            ].map((v) => (
              <div key={v.title}>
                <h4 style={{ marginBottom: '0.4rem' }}>{v.title}</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, opacity: 0.8 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Contacto</h2>
          <p style={{ marginBottom: '0.4rem' }}>Telefono: +57 315 335 5599</p>
          <p style={{ marginBottom: '0.4rem' }}>Email: ventas@kosxpress.com</p>
          <p style={{ marginBottom: '0.4rem' }}>Ubicacion: Bogota, Colombia</p>
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>
            Visitanos en nuestro catalogo en linea y descubre todas las opciones
            que tenemos para tu negocio.
          </p>
        </div>
      </div>
    </AnimatedPage>
  );
}
