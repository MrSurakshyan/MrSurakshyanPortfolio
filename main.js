document.addEventListener('DOMContentLoaded', () => {
  const scrollTrack = document.getElementById('scroll-track');
  const viewport = document.getElementById('viewport');
  const driftContainer = document.getElementById('drift-container');
  const customCursor = document.getElementById('custom-cursor');
  const loader = document.getElementById('loader');
  
  // Details Modal Elements
  const detailsOverlay = document.getElementById('details-overlay');
  const badgeTrigger = document.getElementById('badge-trigger');
  const logoLink = document.getElementById('logo-link');
  const closeDetails = document.getElementById('close-details');

  let cycleWidth = 0;
  let cycleHeight = 0;
  
  // Custom global scroll coordinates for 2D panning with inertia
  let scrollX = 0;
  let scrollY = 0;
  let targetScrollX = 0;
  let targetScrollY = 0;
  const scrollSpeed = 0.08; // Global lerp speed

  // Mouse drift coordinates for parallax depth
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let driftX = 0, driftY = 0;
  let targetDriftX = 0, targetDriftY = 0;
  const driftSpeed = 0.05; // Lerp multiplier for drift

  // Array storing card position records for individual smooth motions
  let cardsData = [];
  let isFirstLoad = true;

  // Drag Panning flags
  let isDragging = false;
  let hasDragged = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startScrollX = 0;
  let startScrollY = 0;

  // 1. Organic 2D Canvas Mapping
  function buildCanvas() {
    if (typeof projects === 'undefined') {
      console.error('Projects data is not loaded!');
      return;
    }

    scrollTrack.innerHTML = '';
    cardsData = [];

    // Columns & Rows layout size configurations to make it dense and full
    const colCount = 6;
    const rowCount = 6;
    
    // Scale cell sizes dynamically based on screen width
    const isMobile = window.innerWidth <= 768;
    const cellWidth = isMobile ? 220 : 340;
    const cellHeight = isMobile ? 300 : 460;
    
    // Target base dimension for visual area equivalence scaling
    const targetSize = isMobile ? 140 : 220;

    cycleWidth = colCount * cellWidth;
    cycleHeight = rowCount * cellHeight;

    // Fisher-Yates shuffle algorithm to randomize grid positions
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // Step A: Calculate organic 2D placement coordinates for one complete set
    const singleSetCoords = [];
    const totalSlots = colCount * rowCount;

    // Build randomized list of projects for the 36 cell slots
    let gridProjects = [...projects];
    while (gridProjects.length < totalSlots) {
      const randomProj = projects[Math.floor(Math.random() * projects.length)];
      gridProjects.push(randomProj);
    }
    shuffleArray(gridProjects);

    // Swap unique video projects to cell index 8 and 9 to guarantee prominent centering side-by-side
    const uniqueVideos = projects.filter(p => p.type === 'video');
    if (uniqueVideos.length >= 2) {
      const idx1 = gridProjects.findIndex(p => p.id === uniqueVideos[0].id);
      if (idx1 !== -1) {
        [gridProjects[idx1], gridProjects[8]] = [gridProjects[8], gridProjects[idx1]];
      }
      const idx2 = gridProjects.findIndex(p => p.id === uniqueVideos[1].id);
      if (idx2 !== -1) {
        [gridProjects[idx2], gridProjects[9]] = [gridProjects[9], gridProjects[idx2]];
      }
    } else if (uniqueVideos.length === 1) {
      const idx = gridProjects.findIndex(p => p.id === uniqueVideos[0].id);
      if (idx !== -1) {
        [gridProjects[idx], gridProjects[8]] = [gridProjects[8], gridProjects[idx]];
      }
    }

    for (let index = 0; index < totalSlots; index++) {
      const project = gridProjects[index];
      const colIdx = index % colCount;
      const rowIdx = Math.floor(index / colCount);

      // Compute dynamic width and height based on original image aspect-ratio
      const ratio = project.ratio || 1.33;
      const cardWidth = Math.round(targetSize * Math.sqrt(ratio));
      const imgHeight = Math.round(targetSize / Math.sqrt(ratio));
      const totalCardHeight = imgHeight + 60; // 60px padding for details block

      // Column-based vertical stagger (odd columns shifted down by cellHeight / 2)
      const columnOffset = (colIdx % 2 === 1) ? (cellHeight / 2) : 0;

      // Horizontal and vertical jitter offsets to make positions staggered
      // X Jitter: Restrict to ±25px (on mobile, ±15px)
      // Y Jitter: Restrict to ±35px (on mobile, ±20px)
      const xJitter = (Math.random() - 0.5) * (isMobile ? 30 : 50);
      const yJitter = (Math.random() - 0.5) * (isMobile ? 40 : 70);

      const x = colIdx * cellWidth + cellWidth / 2 + xJitter - cardWidth / 2;
      const y = rowIdx * cellHeight + cellHeight / 2 + columnOffset + yJitter;

      singleSetCoords.push({
        project,
        x,
        y,
        imgHeight,
        width: cardWidth,
        height: totalCardHeight
      });
    }

    // Step B: Render 3x3 cycle grid stacked vertically and horizontally (9 sets total)
    // cx (0-2) columns, cy (0-2) rows
    for (let cy = 0; cy < 3; cy++) {
      for (let cx = 0; cx < 3; cx++) {
        singleSetCoords.forEach((coord) => {
          const baseX = coord.x + cx * cycleWidth;
          const baseY = coord.y + cy * cycleHeight;

          const card = document.createElement('a');
          card.href = '#';
          card.className = 'project-card';
          card.style.width = `${coord.width}px`;
          
          let mediaHTML = `<img src="${coord.project.src}" alt="${coord.project.title}" class="card-image" loading="lazy">`;
          if (coord.project.type === 'video') {
            mediaHTML = `
              <img src="${coord.project.src}" alt="${coord.project.title}" class="card-image" loading="lazy" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
              <iframe src="https://www.youtube.com/embed/${coord.project.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${coord.project.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3" 
                      class="card-video-iframe" 
                      frameborder="0" 
                      allow="autoplay; encrypted-media; gyroscope" 
                      allowfullscreen
                      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none;">
              </iframe>
            `;
          }

          card.innerHTML = `
            <div class="card-image-wrap" style="height: ${coord.imgHeight}px">
              ${mediaHTML}
            </div>
            <div class="card-details">
              <div class="details-row-top">
                <span class="project-title">${coord.project.title}</span>
                <span class="project-year">${coord.project.year}</span>
              </div>
              <div class="details-row-bottom">
                <span class="project-category">${coord.project.category}</span>
                <span class="project-subtitle">${coord.project.subtitle}</span>
              </div>
            </div>
          `;
          
          // Disable default click trigger if the card is dragged, else open lightbox
          card.addEventListener('click', (e) => {
            e.preventDefault();
            if (hasDragged) {
              e.stopPropagation();
            } else {
              openLightbox(coord.project);
            }
          });

          scrollTrack.appendChild(card);

          // Push positions and individual motion speeds into database
          cardsData.push({
            element: card,
            baseX,
            baseY,
            currentX: baseX - scrollX,
            currentY: baseY - scrollY,
            // Random motion inertia speeds to stagger glides
            speed: 0.11 + Math.random() * 0.04, 
            // Random parallax drift scale factor for floating coordinates depth
            parallax: 0.9 + Math.random() * 0.2
          });
        });
      }
    }

    // Set scroll sizes
    scrollTrack.style.width = `${3 * cycleWidth}px`;
    scrollTrack.style.height = `${3 * cycleHeight}px`;

    // Center scroll coordinates around the video cards (average of cell 8 and cell 9) on load and resize
    const videoCoord1 = singleSetCoords[8];
    const videoCoord2 = singleSetCoords[9] || videoCoord1;
    const avgX = (videoCoord1.x + videoCoord2.x) / 2;
    const avgY = (videoCoord1.y + videoCoord2.y) / 2;
    const avgW = (videoCoord1.width + videoCoord2.width) / 2;
    const avgH = (videoCoord1.height + videoCoord2.height) / 2;

    const initialScrollX = cycleWidth + avgX - window.innerWidth / 2 + avgW / 2;
    const initialScrollY = cycleHeight + avgY - window.innerHeight / 2 + avgH / 2;

    scrollX = initialScrollX;
    scrollY = initialScrollY;
    targetScrollX = initialScrollX;
    targetScrollY = initialScrollY;

    // Reset initial card current positions
    cardsData.forEach(card => {
      card.currentX = card.baseX - scrollX;
      card.currentY = card.baseY - scrollY;
    });

    bindHoverListeners();
  }

  // 2. Lightbox Modal Logic
  let activeProject = null;
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxVideoIframe = document.getElementById('lightbox-video-iframe');
  const lightboxImgBox = document.getElementById('lightbox-img-box');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxYear = document.getElementById('lightbox-year');
  const lightboxCategory = document.getElementById('lightbox-category');
  const lightboxSubtitle = document.getElementById('lightbox-subtitle');
  const closeLightboxBtn = document.getElementById('close-lightbox');

  function openLightbox(project) {
    if (!lightboxOverlay) return;
    
    activeProject = project;
    
    // Clear styles before setting new image source to avoid layout jumps
    if (lightboxImgBox) {
      lightboxImgBox.style.width = '';
      lightboxImgBox.style.height = '';
    }
    
    if (project.type === 'video') {
      if (lightboxImg) lightboxImg.style.display = 'none';
      if (lightboxVideoIframe) {
        lightboxVideoIframe.style.display = 'block';
        lightboxVideoIframe.src = `https://www.youtube.com/embed/${project.youtubeId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`;
      }
      // Force immediate resize since iframes do not fire dynamic onload bounding updates like images
      setTimeout(() => {
        resizeLightboxForVideo(project.ratio || 0.5625);
      }, 50);
    } else {
      if (lightboxVideoIframe) {
        lightboxVideoIframe.style.display = 'none';
        lightboxVideoIframe.src = '';
      }
      if (lightboxImg) {
        lightboxImg.style.display = 'block';
        lightboxImg.src = project.src;
        lightboxImg.alt = project.title;
      }
    }
    
    if (lightboxTitle) lightboxTitle.textContent = project.title;
    if (lightboxYear) lightboxYear.textContent = project.year;
    if (lightboxCategory) lightboxCategory.textContent = project.category;
    if (lightboxSubtitle) lightboxSubtitle.textContent = project.subtitle;
    
    lightboxOverlay.classList.add('active');
    if (customCursor) customCursor.classList.remove('hovered');
  }

  function closeLightbox() {
    activeProject = null;
    if (lightboxVideoIframe) lightboxVideoIframe.src = '';
    if (lightboxOverlay) lightboxOverlay.classList.remove('active');
  }

  function resizeLightboxForVideo(ratio) {
    if (!lightboxImgBox) return;
    const parent = lightboxImgBox.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const parentW = parentRect.width;
    const parentH = parentRect.height;

    let targetW, targetH;
    if (parentW / parentH > ratio) {
      targetH = parentH;
      targetW = parentH * ratio;
    } else {
      targetW = parentW;
      targetH = parentW / ratio;
    }

    lightboxImgBox.style.width = `${Math.round(targetW)}px`;
    lightboxImgBox.style.height = `${Math.round(targetH)}px`;
  }

  function updateLightboxBtnPosition() {
    if (!lightboxOverlay || !lightboxOverlay.classList.contains('active') || !activeProject) return;
    
    if (activeProject.type === 'video') {
      resizeLightboxForVideo(activeProject.ratio || 0.5625);
    } else if (lightboxImg) {
      const rect = lightboxImg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        lightboxImgBox.style.width = `${rect.width}px`;
        lightboxImgBox.style.height = `${rect.height}px`;
      }
    }
  }

  if (lightboxImg) {
    lightboxImg.addEventListener('load', () => {
      requestAnimationFrame(updateLightboxBtnPosition);
    });
  }

  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
  }

  if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', (e) => {
      if (e.target === lightboxOverlay || e.target.classList.contains('lightbox-image-wrap') || e.target === lightboxImg) {
        closeLightbox();
      }
    });
  }

  // 3. Details Modal Toggle Logic
  function toggleDetails(show) {
    if (!detailsOverlay) return;
    
    if (show) {
      detailsOverlay.classList.add('active');
      if (customCursor) customCursor.classList.remove('hovered');
    } else {
      detailsOverlay.classList.remove('active');
    }
  }

  if (badgeTrigger) {
    badgeTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDetails(true);
    });
  }

  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDetails(true);
    });
  }

  if (closeDetails) {
    closeDetails.addEventListener('click', () => {
      toggleDetails(false);
    });
  }

  if (detailsOverlay) {
    detailsOverlay.addEventListener('click', (e) => {
      if (e.target === detailsOverlay) {
        toggleDetails(false);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleDetails(false);
      closeLightbox();
    }
  });

  // 3. Custom Cursor Follower
  let cursorX = 0, cursorY = 0;
  let targetCursorX = 0, targetCursorY = 0;

  document.addEventListener('mousemove', (e) => {
    targetCursorX = e.clientX;
    targetCursorY = e.clientY;
    
    // Track mouse coordinates for background drift parallax
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function updateCursor() {
    cursorX += (targetCursorX - cursorX) * 0.15;
    cursorY += (targetCursorY - cursorY) * 0.15;
    
    if (customCursor) {
      customCursor.style.left = `${cursorX}px`;
      customCursor.style.top = `${cursorY}px`;
    }
    requestAnimationFrame(updateCursor);
  }
  updateCursor();

  function bindHoverListeners() {
    const hoverables = document.querySelectorAll('a, button, .project-card, .close-btn, .close-lightbox-btn');
    hoverables.forEach(elem => {
      elem.addEventListener('mouseenter', () => {
        if (customCursor) customCursor.classList.add('hovered');
      });
      elem.addEventListener('mouseleave', () => {
        if (customCursor) customCursor.classList.remove('hovered');
      });
    });
  }

  // 4. Mouse Scroll Wheel Interceptor (2D scrolling)
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetScrollX += e.deltaX * 1.0;
    targetScrollY += e.deltaY * 1.0;
  }, { passive: false });

  // 5. Drag to Pan Navigation Control (Mouse Click + Drag panning)
  viewport.addEventListener('mousedown', (e) => {
    // Avoid initiating pan on center badge triggers
    if (e.target.closest('#badge-trigger') || e.target.closest('.details-modal') || e.target.closest('.site-header')) return;
    
    isDragging = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startScrollX = targetScrollX;
    startScrollY = targetScrollY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    targetScrollX = startScrollX - dx;
    targetScrollY = startScrollY - dy;

    if (Math.hypot(dx, dy) > 5) {
      hasDragged = true;
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Mobile Touch support for 2D swipe pan
  let isTouchDown = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let startTouchScrollX = 0;
  let startTouchScrollY = 0;

  viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('#badge-trigger') || e.target.closest('.details-modal') || e.target.closest('.site-header')) return;
    isTouchDown = true;
    touchStartX = e.touches[0].pageX;
    touchStartY = e.touches[0].pageY;
    startTouchScrollX = targetScrollX;
    startTouchScrollY = targetScrollY;
  });

  viewport.addEventListener('touchmove', (e) => {
    if (!isTouchDown) return;
    const dx = e.touches[0].pageX - touchStartX;
    const dy = e.touches[0].pageY - touchStartY;
    
    targetScrollX = startTouchScrollX - dx * 1.2;
    targetScrollY = startTouchScrollY - dy * 1.2;
  });

  window.addEventListener('touchend', () => {
    isTouchDown = false;
  });

  // 6. Main Smooth Inertia Rendering Loop (Diagonal wrapping & Individual card glide speeds)
  function animate() {
    // A. Lerp global scroll coordinates
    scrollX += (targetScrollX - scrollX) * scrollSpeed;
    scrollY += (targetScrollY - scrollY) * scrollSpeed;

    // B. Handle Seamless Loop snapping & wrapping shift
    // Horizontal wrapping
    if (scrollX < cycleWidth) {
      scrollX += cycleWidth;
      targetScrollX += cycleWidth;
      // Instant coordinate offset shift for all cards to hide scroll wrap jump
      cardsData.forEach(card => card.currentX -= cycleWidth);
    }
    else if (scrollX >= 2 * cycleWidth) {
      scrollX -= cycleWidth;
      targetScrollX -= cycleWidth;
      cardsData.forEach(card => card.currentX += cycleWidth);
    }

    // Vertical wrapping
    if (scrollY < cycleHeight) {
      scrollY += cycleHeight;
      targetScrollY += cycleHeight;
      cardsData.forEach(card => card.currentY -= cycleHeight);
    }
    else if (scrollY >= 2 * cycleHeight) {
      scrollY -= cycleHeight;
      targetScrollY -= cycleHeight;
      cardsData.forEach(card => card.currentY += cycleHeight);
    }

    // C. Calculate Mouse Drift coordinates
    targetDriftX = (mouseX - window.innerWidth / 2) * -0.015;
    targetDriftY = (mouseY - window.innerHeight / 2) * -0.015;
    
    driftX += (targetDriftX - driftX) * driftSpeed;
    driftY += (targetDriftY - driftY) * driftSpeed;

    // D. Individual card inertia & float positioning updates
    cardsData.forEach((card) => {
      // Each card target coordinate shifts based on its specific depth/parallax factor
      const targetCardX = card.baseX - scrollX + driftX * card.parallax;
      const targetCardY = card.baseY - scrollY + driftY * card.parallax;

      // Lerp each card position individually based on its randomized speed factor
      card.currentX += (targetCardX - card.currentX) * card.speed;
      card.currentY += (targetCardY - card.currentY) * card.speed;

      // Apply transform translation directly on card element
      card.element.style.transform = `translate3d(${card.currentX}px, ${card.currentY}px, 0)`;
    });

    requestAnimationFrame(animate);
  }

  // 7. Handle dynamic resizes
  window.addEventListener('resize', () => {
    buildCanvas();
    updateLightboxBtnPosition();
  });

  // 8. Loader timeout transitions (2.0s triggers transition right as text blurs to eliminate lag)
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (loader) loader.classList.add('loaded');
    }, 200);    
  });

  if (document.readyState === 'complete') {
    setTimeout(() => {
      if (loader) loader.classList.add('loaded');
    }, 200);
  }

  // Initialize Canvas layout and loop animation
  buildCanvas();
  animate();
});
