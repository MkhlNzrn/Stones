(function () {
  'use strict';

  // Mobile nav toggle
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  // Close nav on link click (mobile)
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('open');
    });
  });

  // Load catalog images from /api/works (served by server.js)
  var catalogGrid = document.getElementById('catalog-grid');
  var placeholder = document.getElementById('catalog-placeholder');

  function loadCatalog() {
    fetch('/api/works')
      .then(function (res) { return res.json(); })
      .then(function (files) {
        if (!files || files.length === 0) {
          if (placeholder) placeholder.style.display = 'block';
          return;
        }
        if (placeholder) placeholder.style.display = 'none';
        files.forEach(function (file) {
          var a = document.createElement('a');
          a.href = '/photos/' + encodeURIComponent(file);
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'catalog-item';
          var img = document.createElement('img');
          img.src = '/photos/' + encodeURIComponent(file);
          img.alt = 'Работа';
          img.loading = 'lazy';
          a.appendChild(img);
          catalogGrid.appendChild(a);
        });
      })
      .catch(function () {
        if (placeholder) placeholder.style.display = 'block';
      });
  }

  if (catalogGrid) loadCatalog();

  // Contact form submit
  var form = document.getElementById('order-form');
  var formMessage = document.getElementById('form-message');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.btn-submit');
      var originalText = btn ? btn.textContent : '';

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Отправка…';
      }
      if (formMessage) {
        formMessage.textContent = '';
        formMessage.className = 'form-message';
      }

      var data = new FormData(form);
      var body = {
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        phone: data.get('phone'),
        description: data.get('description')
      };

      fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Ошибка отправки');
          return res.json();
        })
        .then(function () {
          if (formMessage) {
            formMessage.textContent = 'Заявка отправлена. Мы свяжемся с вами в ближайшее время.';
            formMessage.className = 'form-message success';
          }
          form.reset();
        })
        .catch(function () {
          if (formMessage) {
            formMessage.textContent = 'Не удалось отправить заявку. Позвоните нам или напишите на почту.';
            formMessage.className = 'form-message error';
          }
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
          }
        });
    });
  }
})();
