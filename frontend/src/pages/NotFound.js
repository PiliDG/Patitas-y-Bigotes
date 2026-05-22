export default function renderNotFound(container) {
  container.innerHTML = `
    <section class="page-placeholder">
      <h2>Página no encontrada</h2>
      <p>La ruta solicitada no existe. Volvé al inicio.</p>
    </section>
  `;
  return () => {};
}
