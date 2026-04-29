import { supabase } from './supabase.js';
import { exigirAdmin } from './guard.js';

document.addEventListener('DOMContentLoaded', async () => {
  await iniciarHomeAdmin();
});

async function iniciarHomeAdmin() {
  try {
    await exigirAdmin();

    configurarBotaoSair();

  } catch (erro) {
    console.error('Erro ao carregar a área administrativa:', erro);
    alert('Não foi possível carregar a área administrativa.');

    window.location.href = 'index.html';
  }
}

function configurarBotaoSair() {
  const btnSair = document.getElementById('btnSair');

  if (!btnSair) return;

  btnSair.addEventListener('click', async () => {
    const confirmarSaida = confirm('Deseja realmente sair do sistema?');

    if (!confirmarSaida) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Erro ao sair:', error);
      alert('Não foi possível sair. Tente novamente.');
      return;
    }

    window.location.href = 'index.html';
  });
}