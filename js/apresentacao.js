document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggleApresentacao");
  const menu = document.getElementById("menuApresentacao");

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => {
      menu.classList.toggle("show");
    });

    const linksMenu = menu.querySelectorAll("a");

    linksMenu.forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("show");
      });
    });
  }

  const telefoneWhatsapp = "5511999999999";

  const mensagemWhatsapp = encodeURIComponent(
    "Olá, vim pelo site e gostaria de mais informações sobre os cursos."
  );

  const linkWhatsapp = `https://wa.me/${telefoneWhatsapp}?text=${mensagemWhatsapp}`;

  const linkGoogleForms = "#";

  const idsWhatsapp = [
    "btnWhatsappTopo",
    "linkWhatsappContato",
    "btnWhatsappFinal"
  ];

  const idsForms = [
    "btnOrcamento",
    "linkFormsContato",
    "btnOrcamentoFinal"
  ];

  idsWhatsapp.forEach((id) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.href = linkWhatsapp;
    }
  });

  idsForms.forEach((id) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.href = linkGoogleForms;
    }
  });
});