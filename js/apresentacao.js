document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggleApresentacao");
  const menu = document.getElementById("menuApresentacao");
  const navbar = document.querySelector(".site-nav");

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => {
      const aberto = menu.classList.toggle("show");
      menuToggle.setAttribute("aria-expanded", String(aberto));
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("show");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (event) => {
      const clicouNoMenu = menu.contains(event.target);
      const clicouNoBotao = menuToggle.contains(event.target);

      if (!clicouNoMenu && !clicouNoBotao && menu.classList.contains("show")) {
        menu.classList.remove("show");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  const telefoneWhatsapp = "5511956177084";
  const mensagemWhatsapp = encodeURIComponent(
    "Olá, vim pelo site e gostaria de mais informações sobre os cursos da Beehive Idiomas."
  );
  const linkWhatsapp = `https://wa.me/${telefoneWhatsapp}?text=${mensagemWhatsapp}`;

  [
    "btnWhatsappTopo",
    "linkWhatsappContato",
    "btnWhatsappFinal",
    "whatsappFlutuante"
  ].forEach((id) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.href = linkWhatsapp;
    }
  });

  const atualizarNavbar = () => {
    if (!navbar) return;
    navbar.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  atualizarNavbar();
  window.addEventListener("scroll", atualizarNavbar, { passive: true });
});