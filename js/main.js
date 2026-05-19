let currentUnit = 'kg';

function setUnit(u) {
	currentUnit = u;
	document.getElementById('btnKg').classList.toggle('active', u === 'kg');
	document.getElementById('btnLb').classList.toggle('active', u === 'lb');
	document.getElementById('weightUnit').textContent = u === 'kg' ? 'kg' : 'lbs';
	document.getElementById('heightUnit').textContent = u === 'kg' ? 'cm' : 'in';
	document.getElementById('weight').placeholder = u === 'kg' ? '75' : '165';
	document.getElementById('height').placeholder = u === 'kg' ? '175' : '69';
}

function toggleFaq(item) {
	const btn = item.querySelector('.faq-q');
	const isOpen = item.classList.contains('open');
	item.classList.toggle('open');
	item.querySelector('.faq-a').classList.toggle('open');
	btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
}

function calculate() {
	const wRaw = parseFloat(document.getElementById('weight').value);
	const hRaw = parseFloat(document.getElementById('height').value);
	const age = parseInt(document.getElementById('age').value) || 25;
	const gender = document.getElementById('gender').value;
	const activity = parseFloat(document.getElementById('activity').value) || 1.55;
	const goalType = document.getElementById('goalType').value;
	if (!wRaw || wRaw <= 0) {
		alert('Please enter your body weight.');
		return;
	}
	if (!hRaw || hRaw <= 0) {
		alert('Please enter your height.');
		return;
	}
	const wKg = currentUnit === 'lb' ? wRaw * 0.453592 : wRaw;
	const hCm = currentUnit === 'lb' ? hRaw * 2.54 : hRaw;
	const estimatedBF = gender === 'male' ? 15 : 25;
	const lbmKg = wKg * (1 - estimatedBF / 100);
	let bmr;
	if (gender === 'male') {
		bmr = 10 * wKg + 6.25 * hCm - 5 * age + 5;
	} else {
		bmr = 10 * wKg + 6.25 * hCm - 5 * age - 161;
	}
	const tdee = Math.round(bmr * activity);
	let goalAdj = 0;
	switch (goalType) {
		case 'recomp':
			goalAdj = -200;
			break;
		case 'fatloss':
			goalAdj = -500;
			break;
		case 'leanbulk':
			goalAdj = 200;
			break;
		case 'maintenance':
			goalAdj = 0;
			break;
	}
	const targetCals = Math.max(Math.round(tdee + goalAdj), 1200);
	let proteinMultiplier = 2;
	if (goalType === 'fatloss') {
		proteinMultiplier = 2.2;
	}
	if (goalType === 'leanbulk') {
		proteinMultiplier = 1.8;
	}
	const proteinG = Math.round(lbmKg * proteinMultiplier);
	const proteinCals = proteinG * 4;
	let fatRatio = 0.25;
	if (goalType === 'fatloss') {
		fatRatio = 0.30;
	}
	if (goalType === 'leanbulk') {
		fatRatio = 0.22;
	}
	const fatG = Math.round((targetCals * fatRatio) / 9);
	const fatCals = fatG * 9;
	const carbCals = Math.max(targetCals - proteinCals - fatCals, 0);
	const carbG = Math.round(carbCals / 4);
	const breakdownData = [{
		icon: '<i class="bi bi-egg-fill" style="color:var(--accent2)"></i>',
		val: `${proteinG}g`,
		label: 'Daily Protein'
	}, {
		icon: '<i class="bi bi-tsunami" style="color:var(--primary)"></i>',
		val: `${carbG}g`,
		label: 'Daily Carbs'
	}, {
		icon: '<i class="bi bi-droplet-half" style="color:var(--accent3)"></i>',
		val: `${fatG}g`,
		label: 'Daily Fats'
	}, {
		icon: '<i class="bi bi-fire" style="color:var(--accent2)"></i>',
		val: `${tdee.toLocaleString()} kcal`,
		label: 'Maintenance Calories'
	}];
	document.getElementById('resultMain').textContent = targetCals.toLocaleString();
	document.getElementById('resultUnit').textContent = 'kcal per day';
	document.getElementById('breakdownGrid').innerHTML = breakdownData.map(item => `
      <div class="bd-card">

        <div class="bd-icon">
          ${item.icon}
        </div>

        <div class="bd-val">
          ${item.val}
        </div>

        <div class="bd-label">
          ${item.label}
        </div>

      </div>
    `).join('');
	const panel = document.getElementById('resultPanel');
	panel.style.display = 'block';
	setTimeout(() => {
		panel.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest'
		});
	}, 50);
}

function toggleToc() {
	if (window.innerWidth >= 992) return;
	document.getElementById('tocCard').classList.toggle('toc-open');
}
document.querySelectorAll('.toc-card ol li a').forEach(a => {
	a.addEventListener('click', () => {
		if (window.innerWidth < 992) {
			document.getElementById('tocCard').classList.remove('toc-open');
		}
	});
});
const cardObserver = new IntersectionObserver((entries) => {
	entries.forEach((e, i) => {
		if (e.isIntersecting) {
			setTimeout(() => e.target.classList.add('visible'), i * 80);
			cardObserver.unobserve(e.target);
		}
	});
}, {
	threshold: 0.08
});
document.querySelectorAll('.blog-card').forEach(el => cardObserver.observe(el));
window.addEventListener('scroll', () => {
	const btn = document.getElementById('scrollTop');
	if (btn) btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
});
const headings = document.querySelectorAll('.article-body h2[id]');
const tocLinks = document.querySelectorAll('.toc-card ol li a');
window.addEventListener('scroll', () => {
	let current = '';
	headings.forEach(h => {
		if (window.scrollY >= h.offsetTop - 110) current = h.id;
	});
	tocLinks.forEach(a => {
		a.classList.toggle('active', a.getAttribute('href') === '#' + current);
	});
});



  const blogPosts = {{ site.data.blog | jsonify }};

  function getCount(){
    return window.innerWidth <= 768 ? 3 : 4;
  }

  function shuffle(arr){
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function render(){
    const count = getCount();
    const data = shuffle(blogPosts).slice(0, count);

    document.getElementById("blogGrid").innerHTML = data.map(p => `
      <div class="blog-card">

        <div class="blog-thumb">
          <i class="bi ${p.icon}" style="color:${p.color};font-size:2.2rem"></i>
        </div>

        <div class="blog-content">
          <span class="blog-badge ${p.cls}">${p.badge}</span>
          <div class="blog-title">${p.title}</div>
          <div class="blog-excerpt">${p.excerpt}</div>
        </div>

      </div>
    `).join("");
  }

  window.addEventListener("load", render);
  window.addEventListener("resize", render);
