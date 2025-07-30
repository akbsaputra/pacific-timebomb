window.addEventListener('load', () => {
    // --- SCRIPT FOR SECTION 4: SCROLL-BASED ANIMATIONS ---
    const setupObserver = (elementId, visibleClass, hiddenClass, threshold) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    element.classList.add(visibleClass);
                    element.classList.remove(...hiddenClass.split(' '));
                } else {
                    if (entry.boundingClientRect.top > 0) {
                        element.classList.remove(visibleClass);
                        element.classList.add(...hiddenClass.split(' '));
                    }
                }
            });
        };
        const observer = new IntersectionObserver(observerCallback, { root: null, threshold: threshold });
        observer.observe(element);
    };

    setupObserver('left-part', 'visible', 'hidden-left', 0.4);
    setupObserver('right-part', 'visible', 'hidden-right', 0.4);

    // --- SCRIPT FOR UNIFIED SCROLLYTELLING CHART SECTION ---
    async function runScrollyChart() {
        const smokingDataUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/smoking.csv';
        const alcoholDataUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/alcohol.csv';

        try {
            const [smokingData, alcoholData] = await Promise.all([
                d3.csv(smokingDataUrl),
                d3.csv(alcoholDataUrl)
            ]);
            
            const alcoholMap = new Map(alcoholData.map(d => [d.iso2c, d]));
            
            const mergedData = smokingData.map(d => {
                const alcoholRow = alcoholMap.get(d.iso2c);
                return {
                    iso2c: d.iso2c,
                    country: d.country,
                    smoking: +d.smoking,
                    ncd_smoking: +d.ncd,
                    alcohol: alcoholRow ? +alcoholRow.alcohol : 0,
                    ncd_alcohol: alcoholRow ? +alcoholRow.ncd : 0,
                    is_pacific: d.is_pacific === 'TRUE'
                };
            }).filter(d => d.alcohol > 0 && d.smoking > 0);

            const margin = {top: 40, right: 30, bottom: 60, left: 60};
            const container = document.getElementById('scatterplot');
            const width = container.clientWidth - margin.left - margin.right;
            const height = container.clientHeight - margin.top - margin.bottom;

            const svg = d3.select("#scatterplot").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const x = d3.scaleLinear().range([0, width]);
            const y = d3.scaleLinear().range([height, 0]);

            const xAxis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`);
            const yAxis = svg.append("g").attr("class", "y-axis");

            const xLabel = svg.append("text").attr("class", "x-label").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.top + 15).style("fill", "#9CA3AF");
            svg.append("text").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", -margin.left + 20).attr("x", -height / 2).style("fill", "#9CA3AF").text("NCD Mortality Rate (%)");
            
            const dots = svg.append('g').selectAll("circle").data(mergedData, d => d.iso2c).join("circle").attr("class", "dot").attr("r", 5).style("fill", "#60A5FA").style("opacity", 0.7).style("stroke", "white").style("stroke-width", 0.5);

            function updateChart(mode) {
                const xVar = mode === 'smoking' ? 'smoking' : 'alcohol';
                const yVar = mode === 'smoking' ? 'ncd_smoking' : 'ncd_alcohol';
                const label = mode === 'smoking' ? 'Smoking Rate (%)' : 'Alcohol Consumption (Litres per Capita)';
                
                x.domain([0, d3.max(mergedData, d => d[xVar]) * 1.1]);
                y.domain([0, 100]);
                
                xAxis.transition().duration(1000).call(d3.axisBottom(x));
                yAxis.transition().duration(1000).call(d3.axisLeft(y));
                xLabel.text(label);
                
                dots.transition("position").duration(1000).attr("cx", d => x(d[xVar])).attr("cy", d => y(d[yVar]));
            }

            function updateAnnotations(mode, state) {
                const xVar = mode === 'smoking' ? 'smoking' : 'alcohol';
                const yVar = mode === 'smoking' ? 'ncd_smoking' : 'ncd_alcohol';
                const trendline = svg.selectAll(".trendline").data( (state === 'trend' || state === 'pacific') ? [1] : [] );
                trendline.exit().transition().duration(500).style("opacity", 0).remove();

                if (state === 'trend' || state === 'pacific') {
                    const relevantData = mergedData.filter(d => d[xVar] > 0);
                    if (relevantData.length < 2) return;
                    const n = relevantData.length, sumX = d3.sum(relevantData, d => d[xVar]), sumY = d3.sum(relevantData, d => d[yVar]), sumXY = d3.sum(relevantData, d => d[xVar] * d[yVar]), sumXX = d3.sum(relevantData, d => d[xVar] * d[xVar]);
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;
                    const x0 = d3.min(relevantData, d => d[xVar]), x1 = d3.max(relevantData, d => d[xVar]);
                    trendline.enter().append("line").attr("class", "trendline").style("stroke", "#FBBF24").style("stroke-width", 3).attr("x1", x(x0)).attr("y1", y(slope * x0 + intercept)).attr("x2", x(x0)).attr("y2", y(slope * x0 + intercept)).merge(trendline).transition().duration(1000).style("opacity", 1).attr("x1", x(x0)).attr("y1", y(slope * x0 + intercept)).attr("x2", x(x1)).attr("y2", y(slope * x1 + intercept));
                }
                dots.transition("appearance").duration(500).style("fill", d => (d.is_pacific && state === 'pacific') ? "#F472B6" : "#60A5FA").style("r", d => (d.is_pacific && state === 'pacific') ? 8 : 5);
            }

            const steps = d3.selectAll(".chart-step");
            let currentMode = 'smoking', currentStepId = '';
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        const stepId = entry.target.id;
                        if (stepId === currentStepId) return;
                        currentStepId = stepId;
                        const stepNum = parseInt(stepId.split('-')[1]);
                        const newMode = stepNum <= 3 ? 'smoking' : 'alcohol';
                        
                        let state = 'base';
                        if (stepNum === 2 || stepNum === 5) state = 'trend';
                        if (stepNum === 3 || stepNum === 6) state = 'pacific';

                        if (newMode !== currentMode) {
                            currentMode = newMode;
                            updateChart(currentMode);
                        }
                        
                        updateAnnotations(currentMode, state);
                    }
                });
            }, { threshold: 0.6 });
            steps.nodes().forEach(stepNode => observer.observe(stepNode));
            updateChart('smoking');
            updateAnnotations('smoking', 'base');
        } catch (error) {
            console.error("Error loading scatterplot data:", error);
            document.getElementById('scatterplot').innerHTML = `<p class="text-red-400 p-4">Could not load chart data.</p>`;
        }
    }

    async function runDotPlot() {
        const ncdLatestUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/ncd.csv';
        const ncdTimelineUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/ncd_timeline.csv';
        const smokingTimelineUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/smoking_timeline.csv';
        const alcoholTimelineUrl = 'https://raw.githubusercontent.com/akbsaputra/pacific-timebomb/main/data/alcohol_timeline.csv';

        try {
            const [ncdLatest, ncdTimeline, smokingTimeline, alcoholTimeline] = await Promise.all([
                d3.csv(ncdLatestUrl), d3.csv(ncdTimelineUrl), d3.csv(smokingTimelineUrl), d3.csv(alcoholTimelineUrl)
            ]);

            const parseTimelineData = (timelineData, metricName) => {
                const longData = [];
                timelineData.forEach(d => {
                    const countryIso = d.iso3;
                    for (const year in d) {
                        if (!isNaN(parseInt(year)) && d[year]) {
                            longData.push({ iso3: countryIso, year: +year, value: +d[year], metric: metricName });
                        }
                    }
                });
                return longData;
            };

            const allTimelineData = [...parseTimelineData(ncdTimeline, 'ncd'), ...parseTimelineData(smokingTimeline, 'smoking'), ...parseTimelineData(alcoholTimeline, 'alcohol')];
            const timelineByCountry = d3.group(allTimelineData, d => d.iso3);
            const ncdDataMap = new Map(ncdLatest.map(d => [d.iso3, d]));

            const margin = { top: 20, right: 30, bottom: 50, left: 30 };
            const container = document.getElementById('dot-plot-container');
            container.style.height = '150px';
            const width = container.clientWidth - margin.left - margin.right;
            const height = container.clientHeight - margin.top - margin.bottom;

            const svg = d3.select("#dot-plot-container").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
            
            svg.append("defs").append("marker").attr("id", "arrowhead").attr("viewBox", "-0 -5 10 10").attr("refX", 5).attr("refY", 0).attr("orient", "auto").attr("markerWidth", 8).attr("markerHeight", 8).attr("xoverflow", "visible").append("svg:path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#9CA3AF");

            const x = d3.scaleLinear().range([0, width]);
            const xAxisLine = svg.append("line").attr("class", "x-axis-line").attr("y1", height).attr("y2", height).attr("stroke", "#9CA3AF").attr("marker-end", "url(#arrowhead)");
            const xAxisLabels = svg.append("g").attr("class", "x-axis-labels");
            const xLabel = svg.append("text").attr("class", "x-label text-xs text-gray-400").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + 35);
            const tooltip = d3.select("#tooltip");

            function updateDotPlot(metric) {
                const data = ncdLatest.filter(d => d[metric] && d[metric] !== '#N/A' && !isNaN(parseFloat(d[metric])));
                const domain = d3.extent(data, d => +d[metric]);
                x.domain(domain).nice();
                
                xAxisLine.transition().duration(800).attr("x1", x.range()[0]).attr("x2", x.range()[1]);
                
                const unitMap = { ncd: 'Deaths per 100k', smoking: 'Deaths per 100k', alcohol: 'Litres per Capita' };
                xLabel.text(`Value (${unitMap[metric] || ''})`);

                const tickValues = [domain[0], domain[0] + (domain[1] - domain[0]) / 2, domain[1]];
                xAxisLabels.selectAll("text").data(tickValues).join("text")
                    .transition().duration(800)
                    .attr("x", d => x(d))
                    .attr("y", height + 20)
                    .attr("text-anchor", "middle")
                    .attr("class", "text-xs text-gray-400")
                    .text(d => Math.round(d * 10) / 10);

                const dots = svg.selectAll(".dot-plot-dot").data(data, d => d.iso3);
                dots.enter().append("circle").attr("class", "dot dot-plot-dot").attr("r", 8).style("fill", "#3B82F6")
                    .on("mouseover", function(event, d) {
                        tooltip.style("opacity", 1).html(`<strong>${d.country}</strong><br/>${metric.toUpperCase()}: ${parseFloat(d[metric]).toFixed(1)}`);
                    })
                    .on("mousemove", function(event, d) {
                        tooltip.style("left", (event.clientX + 15) + "px")
                               .style("top", (event.clientY - 28) + "px");
                    })
                    .on("mouseout", function(event, d) {
                        tooltip.style("opacity", 0);
                    })
                    .on("click", (event, d) => {
                        svg.selectAll(".dot-plot-dot").classed("selected", false);
                        d3.select(event.currentTarget).classed("selected", true);
                        showTimelinePanel(d.iso3);
                    })
                    .attr("cy", height)
                    .attr("cx", d => x(+d[metric]))
                    .merge(dots)
                    .transition().duration(800).ease(d3.easeCubicOut)
                    .attr("cx", d => x(+d[metric]));
                dots.exit().remove();
            }

            const infoPanel = d3.select("#info-panel"), panelTitle = d3.select("#panel-title"), panelContent = d3.select("#panel-content"), closePanelButton = d3.select("#close-panel");

            function showTimelinePanel(iso3) {
                const countryData = ncdDataMap.get(iso3);
                panelContent.html("");

                // Add country image if available
                if (countryData.image && countryData.image !== '#N/A') {
                    const imageContainer = panelContent.append("div").attr("class", "relative mb-4 -m-0");
                    imageContainer.append("img")
                        .attr("src", countryData.image)
                        .attr("alt", countryData.country)
                        .attr("class", "w-full h-32 object-cover rounded-t-lg");
                    
                    // Add gradient overlay
                    const gradientOverlay = imageContainer.append("div")
                        .attr("class", "absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-800 rounded-t-lg");
                    
                    // Add country name over the image with left margin
                    imageContainer.append("div")
                        .attr("class", "absolute bottom-2 left-6 right-4")
                        .append("h2")
                        .attr("class", "text-2xl font-bold text-white drop-shadow-lg")
                        .text(countryData.country);
                } else {
                    // If no image, add country name at top with padding
                    panelContent.append("div").attr("class", "px-6 pt-6 mb-4")
                        .append("h2")
                        .attr("class", "text-2xl font-bold text-white")
                        .text(countryData.country);
                }

                const description = countryData.description || "No description available.";
                panelContent.append("p").attr("class", "text-gray-300 mb-4 px-6").text(description);

                const chartsContainer = panelContent.append("div").attr("class", "timeline-charts-grid");
                const metrics = ['ncd', 'smoking', 'alcohol'];
                
                // Use a timeout to ensure DOM elements are rendered
                setTimeout(() => {
                    metrics.forEach(metric => {
                        const container = chartsContainer.append("div").attr("class", "timeline-chart-container");
                        const countryTimeline = (timelineByCountry.get(iso3) || []).filter(d => d.metric === metric);
                        
                        container.append("h3").attr("class", "text-md font-bold text-white capitalize mb-2").text(`${metric} Timeline`);
                        
                        // Use smaller chart widths to prevent overlap, with mobile adjustment
                        const chartWidth = window.innerWidth > 768 ? 180 : window.innerWidth - 80; // Mobile: full width minus padding
                        const lineMargin = { top: 5, right: 10, bottom: 30, left: 35 };
                        const panelWidth = chartWidth - lineMargin.left - lineMargin.right;
                        const panelHeight = 120 - lineMargin.top - lineMargin.bottom;
                        const lineSvg = container.append("svg").attr("width", panelWidth + lineMargin.left + lineMargin.right).attr("height", panelHeight + lineMargin.top + lineMargin.bottom).append("g").attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

                        if (countryTimeline.length === 0) {
                            lineSvg.append("text").attr("x", panelWidth/2).attr("y", panelHeight/2).attr("text-anchor", "middle").attr("class", "text-gray-400 text-sm").text(`No data`);
                            return;
                        }
                        
                        const lineX = d3.scaleTime().domain(d3.extent(countryTimeline, d => new Date(d.year, 0, 1))).range([0, panelWidth]);
                        const lineY = d3.scaleLinear().domain([0, d3.max(countryTimeline, d => d.value)]).range([panelHeight, 0]).nice();
                        
                        lineSvg.append("g").attr("transform", `translate(0, ${panelHeight})`).call(d3.axisBottom(lineX).ticks(3).tickFormat(d3.timeFormat("%Y")));
                        lineSvg.append("g").call(d3.axisLeft(lineY).ticks(3));
                        
                        const colorMap = { ncd: '#34D399', smoking: '#F87171', alcohol: '#60A5FA' };

                        if (countryTimeline.length > 1) {
                            lineSvg.append("path").datum(countryTimeline).attr("fill", "none").attr("stroke", colorMap[metric]).attr("stroke-width", 2.5).attr("d", d3.line().x(d => lineX(new Date(d.year, 0, 1))).y(d => lineY(d.value)));
                        } else {
                            lineSvg.selectAll(".timeline-dot")
                                .data(countryTimeline)
                                .enter()
                                .append("circle")
                                .attr("class", "timeline-dot")
                                .attr("cx", d => lineX(new Date(d.year, 0, 1)))
                                .attr("cy", d => lineY(d.value))
                                .attr("r", 4)
                                .style("fill", colorMap[metric]);
                        }
                    });
                }, 100); // Small delay to ensure DOM is ready
                
                infoPanel.classed("visible", true);
            }
            
            closePanelButton.on("click", () => {
                infoPanel.classed("visible", false)
                svg.selectAll(".dot-plot-dot").classed("selected", false);
            });
            d3.selectAll("input[name='metric-radio']").on("change", (event) => {
                updateDotPlot(event.target.value);
                infoPanel.classed("visible", false);
                svg.selectAll(".dot-plot-dot").classed("selected", false);
            });
            updateDotPlot("ncd");
        } catch (error) {
            console.error("Error loading dot plot data:", error);
            document.getElementById('dot-plot-container').innerHTML = `<p class="text-red-400 p-4">Could not load chart data.</p>`;
        }
    }

    function initializeWhenReady(initFunction, containerId) {
        const container = document.getElementById(containerId);
        if (container && container.clientWidth > 0) {
            initFunction();
        } else {
            requestAnimationFrame(() => initializeWhenReady(initFunction, containerId));
        }
    }

    initializeWhenReady(runScrollyChart, 'scatterplot');
    initializeWhenReady(runDotPlot, 'dot-plot-section');
});