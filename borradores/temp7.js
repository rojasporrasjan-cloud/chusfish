
  function endTour() {
    document.getElementById('tour-card').classList.remove('show');
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    const url = new URL(window.location);
    url.searchParams.delete('tour');
    window.history.replaceState({}, '', url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tour') === '1') {
      let tourStep = 1;
      const tourCard = document.getElementById('tour-card');
      const tourTitle = document.getElementById('tour-title');
      const tourText = document.getElementById('tour-text');
      const tourBtn = document.getElementById('tour-close-btn');

      // Paso 1: Bajar hasta los productos y destacar el primero
      setTimeout(() => { 
        tourCard.classList.add('show'); 
        
        // Buscar la sección de productos y hacer scroll suave
        const catalogSec = document.getElementById('productos');
        if(catalogSec) {
          const y = catalogSec.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({top: y, behavior: 'smooth'});
        }

        // Destacar el primer producto (destacado o normal)
        setTimeout(() => {
          const firstProduct = document.querySelector('.dest-card, .p-card');
          if(firstProduct) firstProduct.classList.add('tour-highlight');
        }, 800);

      }, 1500);

      // Observador para detectar cambios y avanzar en el tour
      const observer = new MutationObserver(() => {
        const modalOpen = document.getElementById('product-modal').classList.contains('open');
        const cartOpen = document.getElementById('cart-backdrop').classList.contains('open');
        const cartItems = document.querySelectorAll('.cart-item').length;

        if (tourStep === 1 && modalOpen) {
          tourStep = 2;
          tourTitle.innerText = "¡Excelente!";
          tourText.innerText = "Ahora elige la cantidad que deseas y haz clic en 'Agregar al carrito'.";
          
          // Quitar highlight del producto
          document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
          
          // Poner highlight al boton de agregar al carrito del modal
          const modalAddBtn = document.getElementById('pm-add');
          if(modalAddBtn) modalAddBtn.classList.add('tour-highlight');
        }
        else if (tourStep === 2 && cartItems > 0 && !modalOpen) {
          // Solo avanzar si ya se cerró el modal o se agregó (el modal se cierra auto al agregar)
          tourStep = 3;
          tourTitle.innerText = "¡Producto agregado!";
          tourText.innerText = "Haz clic en el carrito dorado flotante en la esquina inferior derecha para revisar tu pedido.";
          
          document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
          const cartFloat = document.querySelector('.cart-float');
          if(cartFloat) cartFloat.classList.add('tour-highlight');
        }
        else if (tourStep === 3 && cartOpen) {
          tourStep = 4;
          tourTitle.innerText = "¡Casi listo!";
          tourText.innerText = "Revisa tu pedido y haz clic en 'Enviar pedido por WhatsApp' para dejarnos tus datos. ¡Así de fácil!";
          tourBtn.style.display = 'inline-block';
          
          document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
          const waBtn = document.getElementById('cart-wa-btn');
          if(waBtn) waBtn.classList.add('tour-highlight');
        }
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  });
