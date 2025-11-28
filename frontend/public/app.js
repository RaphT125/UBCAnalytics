const API_BASE_URL = 'http://localhost:4321';

let currentDatasets = [];
let charts = {
    chart1: null,
    chart2: null,
    chart3: null
};

document.addEventListener('DOMContentLoaded', () => {
    loadDatasets();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('addDatasetBtn').addEventListener('click', addDataset);
}

async function loadDatasets() {
    try {
        const response = await fetch(`${API_BASE_URL}/dataset/`);
        const data = await response.json();
        
        if (response.ok) {
            currentDatasets = data.response || [];
            displayDatasets();
        } else {
            showFeedback('addFeedback', `Error loading datasets: ${data.error}`, 'error');
        }
    } catch (error) {
        showFeedback('addFeedback', `Error loading datasets: ${error.message}`, 'error');
    }
}

function displayDatasets() {
    const container = document.getElementById('datasetsList');
    
    if (currentDatasets.length === 0) {
        container.innerHTML = '<p class="loading">No datasets added yet. Add one above to get started!</p>';
        return;
    }
    
    container.innerHTML = currentDatasets.map(dataset => `
        <div class="dataset-item">
            <div class="dataset-info">
                <h3>${dataset.id}</h3>
                <p>Type: ${dataset.kind} | Rows: ${dataset.numRows.toLocaleString()}</p>
            </div>
            <div class="dataset-actions">
                <button class="btn btn-info" onclick="viewInsights('${dataset.id}')">View Insights</button>
                <button class="btn btn-danger" onclick="removeDataset('${dataset.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

async function addDataset() {
    const id = document.getElementById('datasetId').value.trim();
    const fileInput = document.getElementById('datasetFile');
    const kind = document.getElementById('datasetKind').value;
    
    if (!id) {
        showFeedback('addFeedback', 'Please enter a dataset ID', 'error');
        return;
    }
    
    if (id.includes('_')) {
        showFeedback('addFeedback', 'Dataset ID cannot contain underscores', 'error');
        return;
    }
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showFeedback('addFeedback', 'Please select a ZIP file', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    if (!file.name.endsWith('.zip')) {
        showFeedback('addFeedback', 'Please upload a ZIP file', 'error');
        return;
    }
    
    try {
        showFeedback('addFeedback', 'Adding dataset...', 'success');
        
        const arrayBuffer = await file.arrayBuffer();
        
        const response = await fetch(`${API_BASE_URL}/dataset/${id}/${kind}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: arrayBuffer
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showFeedback('addFeedback', `Dataset "${id}" added successfully!`, 'success');
            document.getElementById('datasetId').value = '';
            document.getElementById('datasetFile').value = '';
            await loadDatasets();
        } else {
            showFeedback('addFeedback', `Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showFeedback('addFeedback', `Error adding dataset: ${error.message}`, 'error');
    }
}

async function removeDataset(id) {
    if (!confirm(`Are you sure you want to remove dataset "${id}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/dataset/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showFeedback('addFeedback', `Dataset "${id}" removed successfully!`, 'success');
            
            await loadDatasets();
            
            const insightsContainer = document.getElementById('insightsContainer');
            const selectedDatasetTitle = document.getElementById('selectedDatasetTitle').textContent;
            if (selectedDatasetTitle.includes(id)) {
                insightsContainer.style.display = 'none';
            }
        } else {
            showFeedback('addFeedback', `Error: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showFeedback('addFeedback', `Error removing dataset: ${error.message}`, 'error');
    }
}

async function viewInsights(datasetId) {
    const insightsContainer = document.getElementById('insightsContainer');
    const selectedDatasetTitle = document.getElementById('selectedDatasetTitle');
    
    selectedDatasetTitle.textContent = `Insights for: ${datasetId}`;
    insightsContainer.style.display = 'block';
    insightsContainer.scrollIntoView({ behavior: 'smooth' });
    
    try {
        await Promise.all([
            createInsight1(datasetId),
            createInsight2(datasetId),
            createInsight3(datasetId)
        ]);
    } catch (error) {
        console.error('Error creating insights:', error);
        alert(`Error loading insights: ${error.message}`);
    }
}

async function createInsight1(datasetId) {
    try {
        const query = {
            "WHERE": {},
            "OPTIONS": {
                "COLUMNS": [
                    `${datasetId}_dept`,
                    "avgGrade"
                ]
            },
            "TRANSFORMATIONS": {
                "GROUP": [`${datasetId}_dept`],
                "APPLY": [{
                    "avgGrade": {
                        "AVG": `${datasetId}_avg`
                    }
                }]
            }
        };
        
        const response = await fetch(`${API_BASE_URL}/dataset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });
        
        const data = await response.json();
        
        if (response.ok && data.response) {
            const results = data.response;
            
            const sorted = results.sort((a, b) => b.avgGrade - a.avgGrade).slice(0, 15);
            
            const labels = sorted.map(r => r[`${datasetId}_dept`]);
            const values = sorted.map(r => r.avgGrade);
            
            if (charts.chart1) {
                charts.chart1.destroy();
            }
            
            const ctx = document.getElementById('chart1').getContext('2d');
            charts.chart1 = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Grade',
                        data: values,
                        backgroundColor: 'rgba(102, 126, 234, 0.6)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Average Grade (%)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Department'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Top 15 Departments by Average Grade'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating insight 1:', error);
    }
}

async function createInsight2(datasetId) {
    try {
        const query = {
            "WHERE": {},
            "OPTIONS": {
                "COLUMNS": [
                    `${datasetId}_dept`,
                    `${datasetId}_id`,
                    "totalPass",
                    "totalFail"
                ]
            },
            "TRANSFORMATIONS": {
                "GROUP": [`${datasetId}_dept`, `${datasetId}_id`],
                "APPLY": [
                    {
                        "totalPass": {
                            "SUM": `${datasetId}_pass`
                        }
                    },
                    {
                        "totalFail": {
                            "SUM": `${datasetId}_fail`
                        }
                    }
                ]
            }
        };
        
        const response = await fetch(`${API_BASE_URL}/dataset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });
        
        const data = await response.json();
        
        if (response.ok && data.response) {
            const results = data.response;
            
            const sorted = results
                .map(r => ({
                    ...r,
                    total: r.totalPass + r.totalFail
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
            
            const labels = sorted.map(r => `${r[`${datasetId}_dept`]} ${r[`${datasetId}_id`]}`);
            const passData = sorted.map(r => r.totalPass);
            const failData = sorted.map(r => r.totalFail);
            
            if (charts.chart2) {
                charts.chart2.destroy();
            }
            
            const ctx = document.getElementById('chart2').getContext('2d');
            charts.chart2 = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Pass',
                            data: passData,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2
                        },
                        {
                            label: 'Fail',
                            data: failData,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Course'
                            }
                        },
                        y: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Number of Students'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Pass vs Fail - Top 10 Courses by Enrollment'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating insight 2:', error);
    }
}

async function createInsight3(datasetId) {
    try {
        const query = {
            "WHERE": {
                "GT": {
                    [`${datasetId}_year`]: 1900
                }
            },
            "OPTIONS": {
                "COLUMNS": [
                    `${datasetId}_year`,
                    "avgGrade"
                ],
                "ORDER": `${datasetId}_year`
            },
            "TRANSFORMATIONS": {
                "GROUP": [`${datasetId}_year`],
                "APPLY": [{
                    "avgGrade": {
                        "AVG": `${datasetId}_avg`
                    }
                }]
            }
        };
        
        const response = await fetch(`${API_BASE_URL}/dataset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });
        
        const data = await response.json();
        
        if (response.ok && data.response) {
            const results = data.response;
            
            const labels = results.map(r => r[`${datasetId}_year`]);
            const values = results.map(r => r.avgGrade);
            
            if (charts.chart3) {
                charts.chart3.destroy();
            }
            
            const ctx = document.getElementById('chart3').getContext('2d');
            charts.chart3 = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Grade',
                        data: values,
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Average Grade (%)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Year'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Grade Trends Over Time'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating insight 3:', error);
    }
}

function showFeedback(elementId, message, type) {
    const feedbackEl = document.getElementById(elementId);
    feedbackEl.textContent = message;
    feedbackEl.className = `feedback ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 5000);
    }
}