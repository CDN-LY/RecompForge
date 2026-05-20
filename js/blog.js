const blogPosts = [
  {
    icon:"bi-basket2-fill",
    color:"var(--primary)",
    badge:"Nutrition",
    cls:"",
    title:"Best Foods for Recomposition",
    excerpt:"High protein foods for fat loss + muscle gain."
  },
  {
    icon:"bi-person-arms-up",
    color:"var(--accent)",
    badge:"Training",
    cls:"blue",
    title:"Skinny Fat Guide",
    excerpt:"Fix skinny fat with smart training."
  },
  {
    icon:"bi-exclamation-triangle-fill",
    color:"var(--accent2)",
    badge:"Mistakes",
    cls:"orange",
    title:"Bulk Mistakes",
    excerpt:"Avoid fat gain during bulking."
  },
  {
    icon:"bi-egg-fill",
    color:"var(--primary)",
    badge:"Nutrition",
    cls:"",
    title:"Protein Guide",
    excerpt:"Daily protein requirement explained."
  }
];

function shuffle(arr){
  return [...arr].sort(() => Math.random() - 0.5);
}

function render(){
  const data = shuffle(blogPosts).slice(0, 4);

  document.getElementById("blogGrid").innerHTML = data.map(p => `
    <div class="blog-card visible">

      <div class="blog-thumb">
        <i class="bi ${p.icon}" style="color:${p.color};font-size:2.2rem"></i>
      </div>

      <div class="blog-content">

        <span class="blog-badge ${p.cls}">
          ${p.badge}
        </span>

        <div class="blog-title">${p.title}</div>

        <div class="blog-excerpt">${p.excerpt}</div>

        <a href="./guides.html" class="blog-read">
          Read Guide <i class="bi bi-arrow-right"></i>
        </a>

      </div>

    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", render);