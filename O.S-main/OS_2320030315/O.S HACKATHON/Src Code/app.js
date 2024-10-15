document.addEventListener("DOMContentLoaded", function () {
    let processes = [];

    document.getElementById('quantumInput').style.display = 'none';

    document.getElementById('algorithm').addEventListener('change', function() {
        const algorithm = document.getElementById('algorithm').value;
        if (algorithm === 'roundrobin') {
            document.getElementById('quantumInput').style.display = 'block';
        } else {
            document.getElementById('quantumInput').style.display = 'none';
        }
    });

    // Generate input fields based on the number of processes
    document.getElementById('generateInputs').addEventListener('click', function () {
        const numProcesses = parseInt(document.getElementById('numProcesses').value);
        if (isNaN(numProcesses) || numProcesses <= 0) {
            alert('Please enter a valid number of processes');
            return;
        }

        const processInputSection = document.getElementById('processInputSection');
        processInputSection.innerHTML = ''; // Clear previous input fields

        for (let i = 1; i <= numProcesses; i++) {
            const div = document.createElement('div');
            div.classList.add('input-row');
            div.innerHTML = `
                <label>Process ${i}</label>
                <input type="number" placeholder="Arrival Time" id="arrival-${i}">
                <input type="number" placeholder="Burst Time" id="burst-${i}">
                <input type="number" placeholder="Priority (optional)" id="priority-${i}">
            `;
            processInputSection.appendChild(div);
        }
    });

    // Collect the input processes and run the selected algorithm
    document.getElementById('simulate').addEventListener('click', function () {
        const numProcesses = parseInt(document.getElementById('numProcesses').value);
        processes = [];

        for (let i = 1; i <= numProcesses; i++) {
            const arrivalTime = parseInt(document.getElementById(`arrival-${i}`).value);
            const burstTime = parseInt(document.getElementById(`burst-${i}`).value);
            const priority = parseInt(document.getElementById(`priority-${i}`).value) || 0;

            if (isNaN(arrivalTime) || isNaN(burstTime)) {
                alert(`Please enter valid arrival and burst times for Process ${i}`);
                return;
            }

            processes.push({
                id: `P${i}`,
                arrivalTime,
                burstTime,
                priority,
                remainingTime: burstTime, // For preemptive algorithms
                completionTime: 0,
                waitingTime: 0,
                turnaroundTime: 0,
                startTime: 0
            });
        }

        const algorithm = document.getElementById('algorithm').value;
        if (algorithm === 'fcfs') simulateFCFS();
        else if (algorithm === 'sjf') simulateSJF(false);
        else if (algorithm === 'sjf-preemptive') simulateSJF(true);
        else if (algorithm === 'priority') simulatePriority();
        else if (algorithm === 'roundrobin') simulateRoundRobin();
    });

    function simulateFCFS() {
        const sortedProcesses = processes.slice().sort((a, b) => a.arrivalTime - b.arrivalTime);
        executeProcesses(sortedProcesses);
    }

    function simulateSJF(isPreemptive) {
        if (!isPreemptive) {
            const sortedProcesses = processes.slice().sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime);
            executeProcesses(sortedProcesses);
        } else {
            simulatePreemptiveSJF();
        }
    }

    function simulatePriority() {
        const sortedProcesses = processes.slice().sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime);
        executeProcesses(sortedProcesses);
    }

    function simulateRoundRobin() {
        const timeQuantum = parseInt(document.getElementById('quantum').value);
        if (isNaN(timeQuantum) || timeQuantum <= 0) {
            alert('Please enter a valid time quantum for Round Robin.');
            return;
        }

        let time = 0;
        const queue = [];
        let completedProcesses = 0;
        const ganttChart = document.getElementById('ganttChart');
        ganttChart.innerHTML = '';

        while (completedProcesses < processes.length) {
            // Push all processes that have arrived into the queue
            processes.forEach((process) => {
                if (process.arrivalTime <= time && process.remainingTime > 0 && !queue.includes(process)) {
                    queue.push(process);
                }
            });

            if (queue.length === 0) {
                time++; // If no process is ready, just increment time
                continue;
            }

            const process = queue.shift(); // Get the first process in the queue
            const executionTime = Math.min(timeQuantum, process.remainingTime);
            process.remainingTime -= executionTime;
            time += executionTime;

            // If the process is completed, set completion time
            if (process.remainingTime === 0) {
                process.completionTime = time;
                completedProcesses++;
                process.turnaroundTime = process.completionTime - process.arrivalTime;
                process.waitingTime = process.turnaroundTime - process.burstTime;
            } else {
                queue.push(process); // Add back to queue if not finished
            }

            updateGanttChart(ganttChart, process, executionTime, time);
        }

        calculateMetrics();
    }

    function simulatePreemptiveSJF() {
        let time = 0;
        const ganttChart = document.getElementById('ganttChart');
        ganttChart.innerHTML = '';

        while (true) {
            let availableProcesses = processes.filter(p => p.arrivalTime <= time && p.remainingTime > 0);
            if (availableProcesses.length === 0) {
                // No process is available; we can either increment time or break if all are complete
                const allCompleted = processes.every(p => p.remainingTime === 0);
                if (allCompleted) break;
                time++;
                continue;
            }

            availableProcesses.sort((a, b) => a.remainingTime - b.remainingTime);
            let process = availableProcesses[0];

            process.remainingTime -= 1;
            time += 1;

            if (process.remainingTime === 0) {
                process.completionTime = time;
                process.turnaroundTime = process.completionTime - process.arrivalTime;
                process.waitingTime = process.turnaroundTime - process.burstTime;
            }

            updateGanttChart(ganttChart, process, 1, time);
        }

        calculateMetrics();
    }

    function executeProcesses(sortedProcesses) {
        let currentTime = 0;
        const ganttChart = document.getElementById('ganttChart');
        ganttChart.innerHTML = '';

        sortedProcesses.forEach((process) => {
            // Waiting time is only calculated after the first execution
            if (currentTime < process.arrivalTime) {
                currentTime = process.arrivalTime; // Jump to the arrival time if CPU is idle
            }
            const waitingTime = currentTime - process.arrivalTime;
            process.waitingTime = waitingTime;
            process.completionTime = currentTime + process.burstTime;
            process.turnaroundTime = process.completionTime - process.arrivalTime;

            updateGanttChart(ganttChart, process, process.burstTime, process.completionTime);
            currentTime += process.burstTime;
        });

        calculateMetrics();
    }

    function updateGanttChart(ganttChart, process, timeSlice, completionTime) {
        const processDiv = document.createElement('div');
        processDiv.classList.add('process', `process-${process.id.toLowerCase()}`);
        processDiv.style.width = `${timeSlice * 50}px`;
        processDiv.textContent = `${process.id} (${completionTime})`;  // Show process ID with completion time
        ganttChart.appendChild(processDiv);
    }

    function calculateMetrics() {
        let totalWaitingTime = 0;
        let totalTurnaroundTime = 0;

        processes.forEach((process) => {
            totalWaitingTime += process.waitingTime;
            totalTurnaroundTime += process.turnaroundTime;
        });

        const avgWaitingTime = totalWaitingTime / processes.length;
        const avgTurnaroundTime = totalTurnaroundTime / processes.length;

        showMetrics(avgWaitingTime, avgTurnaroundTime);
    }

    function showMetrics(avgWaitingTime, avgTurnaroundTime) {
        const metrics = `
            <strong>Average Waiting Time:</strong> ${avgWaitingTime.toFixed(2)}<br>
            <strong>Average Turnaround Time:</strong> ${avgTurnaroundTime.toFixed(2)}
        `;
        document.getElementById('metrics').innerHTML = metrics;
    }
});
