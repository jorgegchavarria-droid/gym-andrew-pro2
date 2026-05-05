// GymRoutine Pro - Complete Workout Application - Production Ready
class GymRoutineApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.currentRoutine = null;
        this.workoutTimer = null;
        this.restTimer = null;
        this.currentExerciseIndex = 0;
        this.workoutHistory = [];
        this.userData = this.loadUserData();
        this.isLoading = false;
        this.init();
    }

    // Input sanitization and validation
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }

    validateUserData(data) {
        const schema = {
            workoutHistory: 'array',
            stats: {
                totalWorkouts: 'number',
                totalCalories: 'number',
                streakDays: 'number',
                lastWorkoutDate: 'string|null'
            },
            progress: {
                weight: 'array',
                measurements: 'array'
            }
        };

        return this.validateSchema(data, schema);
    }

    validateSchema(data, schema) {
        if (typeof data !== 'object' || data === null) return false;
        
        for (const [key, expectedType] of Object.entries(schema)) {
            if (!(key in data)) return false;
            
            if (typeof expectedType === 'object') {
                if (!this.validateSchema(data[key], expectedType)) return false;
            } else if (expectedType === 'array' && !Array.isArray(data[key])) {
                return false;
            } else if (typeof expectedType === 'string') {
                const [type, nullable] = expectedType.split('|');
                if (nullable === 'null' && data[key] === null) continue;
                if (typeof data[key] !== type) return false;
            }
        }
        
        return true;
    }

    safeSetHTML(element, html) {
        if (!element) return;
        const sanitized = this.sanitizeInput(html.toString());
        element.textContent = sanitized;
    }

    safeCreateElement(tag, content, attributes = {}) {
        const element = document.createElement(tag);
        
        if (content) {
            this.safeSetHTML(element, content);
        }
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = this.sanitizeInput(value);
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, this.sanitizeInput(value));
            } else {
                element.setAttribute(key, value);
            }
        });
        
        return element;
    }

    init() {
        try {
            this.hideLoadingScreen();
            this.setupEventListeners();
            this.loadExercises();
            this.loadRoutines();
            this.updateDashboard();
            this.showSection('dashboard');
            this.setupKeyboardNavigation();
        } catch (error) {
            this.handleError('Error initializing app:', error);
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 300);
        }
    }

    handleError(message, error) {
        console.error(message, error);
        // Log error for monitoring
        this.logError(message, error);
        
        // Show user-friendly error message
        this.showNotification('Ha ocurrido un error. Por favor, recarga la página.', 'error');
    }

    logError(message, error) {
        // In production, send to error monitoring service
        const errorData = {
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Store error locally for debugging
        const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        errors.push(errorData);
        
        // Keep only last 50 errors
        if (errors.length > 50) {
            errors.splice(0, errors.length - 50);
        }
        
        localStorage.setItem('app_errors', JSON.stringify(errors));
    }

    showNotification(message, type = 'info') {
        const notification = this.safeCreateElement('div', message, {
            className: `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
                type === 'error' ? 'bg-red-600 text-white' :
                type === 'success' ? 'bg-green-600 text-white' :
                type === 'warning' ? 'bg-yellow-600 text-white' :
                'bg-blue-600 text-white'
            }`
        });
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeWorkoutModal();
            }
            
            // Tab navigation for modals
            if (e.key === 'Tab' && !document.getElementById('workoutModal').classList.contains('hidden')) {
                const focusableElements = document.querySelectorAll('#workoutModal button, #workoutModal input, #workoutModal [tabindex="0"]');
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }

    setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            const menu = document.getElementById('mobileMenu');
            menu.classList.toggle('hidden');
        });

        // Exercise search
        document.getElementById('exerciseSearch').addEventListener('input', (e) => {
            this.searchExercises(e.target.value);
        });

        // Close modal on outside click
        document.getElementById('workoutModal').addEventListener('click', (e) => {
            if (e.target.id === 'workoutModal') {
                this.closeWorkoutModal();
            }
        });
    }

    // Navigation
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(sectionName).classList.remove('hidden');

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('text-blue-200');
        });

        // Close mobile menu
        document.getElementById('mobileMenu').classList.add('hidden');

        this.currentSection = sectionName;
    }

    // Data Management with validation
    loadUserData() {
        try {
            const saved = localStorage.getItem('gymRoutineData');
            if (!saved) {
                return this.getDefaultUserData();
            }
            
            const data = JSON.parse(saved);
            if (!this.validateUserData(data)) {
                console.warn('Invalid user data found, using defaults');
                return this.getDefaultUserData();
            }
            
            return data;
        } catch (error) {
            this.handleError('Error loading user data:', error);
            return this.getDefaultUserData();
        }
    }

    getDefaultUserData() {
        return {
            workoutHistory: [],
            stats: {
                totalWorkouts: 0,
                totalCalories: 0,
                streakDays: 0,
                lastWorkoutDate: null
            },
            progress: {
                weight: [],
                measurements: []
            }
        };
    }

    saveUserData() {
        try {
            if (!this.validateUserData(this.userData)) {
                throw new Error('Invalid user data structure');
            }
            localStorage.setItem('gymRoutineData', JSON.stringify(this.userData));
        } catch (error) {
            this.handleError('Error saving user data:', error);
        }
    }

    exportUserData() {
        try {
            const dataStr = JSON.stringify(this.userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = this.safeCreateElement('a', '', {
                href: url,
                download: `gym-andrew-backup-${new Date().toISOString().split('T')[0]}.json`
            });
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('Datos exportados correctamente', 'success');
        } catch (error) {
            this.handleError('Error exporting data:', error);
        }
    }

    importUserData(file) {
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (this.validateUserData(data)) {
                        this.userData = data;
                        this.saveUserData();
                        this.updateDashboard();
                        this.showNotification('Datos importados correctamente', 'success');
                    } else {
                        throw new Error('Invalid data format');
                    }
                } catch (error) {
                    this.handleError('Error parsing imported data:', error);
                }
            };
            reader.readAsText(file);
        } catch (error) {
            this.handleError('Error importing data:', error);
        }
    }

    importFileSelected(event) {
        const file = event.target.files[0];
        if (file) {
            this.importUserData(file);
        }
        // Reset file input
        event.target.value = '';
    }

    // Exercise Library
    loadExercises() {
        this.exercises = [
            // Chest exercises
            { id: 1, name: 'Press de banca plano', muscleGroup: 'chest', difficulty: 'beginner', instructions: 'Acuéstate boca arriba en un banco, agarra la barra con las manos separadas a la anchura de los hombros. Baja la barra hasta el pecho y empuja hacia arriba.', sets: 4, reps: 12, calories: 50 },
            { id: 2, name: 'Press de banca inclinado', muscleGroup: 'chest', difficulty: 'intermediate', instructions: 'Similar al press plano pero con el banco inclinado 30-45 grados. Enfócate en la parte superior del pecho.', sets: 3, reps: 10, calories: 45 },
            { id: 3, name: 'Fondos en paralelas', muscleGroup: 'chest', difficulty: 'intermediate', instructions: 'Sujétete a las barras paralelas y baja el cuerpo doblando los codos. Empuja hacia arriba hasta la posición inicial.', sets: 3, reps: 8, calories: 40 },
            { id: 4, name: 'Flexiones (Push-ups)', muscleGroup: 'chest', difficulty: 'beginner', instructions: 'Colócate en posición de plancha con las manos separadas a la anchura de los hombros. Baja el pecho hacia el suelo y empuja hacia arriba.', sets: 3, reps: 15, calories: 35 },
            
            // Back exercises
            { id: 5, name: 'Dominadas (Pull-ups)', muscleGroup: 'back', difficulty: 'intermediate', instructions: 'Agarra la barra con las palms hacia ti. Tira de tu cuerpo hacia arriba hasta que la barbilla pase la barra.', sets: 3, reps: 8, calories: 45 },
            { id: 6, name: 'Remo con barra', muscleGroup: 'back', difficulty: 'beginner', instructions: 'Inclínate con las rodillas ligeramente dobladas. Agarra la barra y tira hacia tu abdomen.', sets: 4, reps: 12, calories: 50 },
            { id: 7, name: 'Remo con mancuerna', muscleGroup: 'back', difficulty: 'beginner', instructions: 'Apoya una rodilla en un banco. Con la otra mano, levanta la mancuerna hacia tu pecho.', sets: 3, reps: 10, calories: 40 },
            { id: 8, name: 'Face pulls', muscleGroup: 'back', difficulty: 'intermediate', instructions: 'Usa una polea alta con cuerda. Tira hacia tu cara manteniendo los codos altos.', sets: 3, reps: 15, calories: 30 },
            
            // Legs exercises
            { id: 9, name: 'Sentadillas (Squats)', muscleGroup: 'legs', difficulty: 'beginner', instructions: 'Párate con los pies separados a la anchura de los hombros. Baja como si te sentaras en una silla y vuelve a subir.', sets: 4, reps: 15, calories: 60 },
            { id: 10, name: 'Peso muerto', muscleGroup: 'legs', difficulty: 'intermediate', instructions: 'Agarra la barra con las rodillas ligeramente dobladas. Levanta la barra extendiendo las piernas y la espalda.', sets: 3, reps: 10, calories: 55 },
            { id: 11, name: 'Zancadas (Lunges)', muscleGroup: 'legs', difficulty: 'beginner', instructions: 'Da un paso adelante y baja la rodilla trasera casi hasta el suelo. Vuelve a la posición inicial.', sets: 3, reps: 12, calories: 40 },
            { id: 12, name: 'Prensa de piernas', muscleGroup: 'legs', difficulty: 'beginner', instructions: 'Siéntate en la máquina de prensa. Empuja la plataforma con las piernas hasta extenderlas.', sets: 4, reps: 15, calories: 50 },
            { id: 13, name: 'Elevación de talones', muscleGroup: 'legs', difficulty: 'beginner', instructions: 'Párate en el borde de un escalón. Levántate sobre las puntas de los pies y baja lentamente.', sets: 4, reps: 20, calories: 25 },
            
            // Shoulders exercises
            { id: 14, name: 'Press militar', muscleGroup: 'shoulders', difficulty: 'beginner', instructions: 'Siéntate con la barra en la parte superior del pecho. Empuja la barra hacia arriba hasta extender los brazos.', sets: 4, reps: 12, calories: 45 },
            { id: 15, name: 'Elevaciones laterales', muscleGroup: 'shoulders', difficulty: 'beginner', instructions: 'Párate con mancuernas a los lados. Levanta los brazos lateralmente hasta la altura de los hombros.', sets: 3, reps: 15, calories: 35 },
            { id: 16, name: 'Elevaciones frontales', muscleGroup: 'shoulders', difficulty: 'beginner', instructions: 'Levanta las mancuernas hacia adelante hasta la altura de los hombros.', sets: 3, reps: 12, calories: 30 },
            { id: 17, name: 'Pájaros (Reverse fly)', muscleGroup: 'shoulders', difficulty: 'intermediate', instructions: 'Inclínate con mancuernas. Abre los brazos como un pájaro volando.', sets: 3, reps: 15, calories: 30 },
            
            // Arms exercises
            { id: 18, name: 'Curl de bíceps', muscleGroup: 'arms', difficulty: 'beginner', instructions: 'Párate con mancuernas. Flexiona los codos llevando las mancuernas hacia los hombros.', sets: 3, reps: 12, calories: 25 },
            { id: 19, name: 'Fondos de tríceps', muscleGroup: 'arms', difficulty: 'beginner', instructions: 'Siéntate en el borde de un banco. Apoya las manos y levanta el cuerpo. Baja doblando los codos.', sets: 3, reps: 15, calories: 30 },
            { id: 20, name: 'Extensión de tríceps en polea', muscleGroup: 'arms', difficulty: 'beginner', instructions: 'Usa una polea alta con barra. Empuja la barra hacia abajo extendiendo los brazos.', sets: 3, reps: 12, calories: 25 },
            { id: 21, name: 'Martillo de bíceps', muscleGroup: 'arms', difficulty: 'intermediate', instructions: 'Como el curl normal pero con las palms mirando entre sí durante todo el movimiento.', sets: 3, reps: 10, calories: 25 },
            
            // Core exercises
            { id: 22, name: 'Plancha (Plank)', muscleGroup: 'core', difficulty: 'beginner', instructions: 'Apoya los antebrazos y las puntas de los pies. Mantén el cuerpo recto y contrae el abdomen.', sets: 3, reps: '60 seg', calories: 20 },
            { id: 23, name: 'Abdominales crunch', muscleGroup: 'core', difficulty: 'beginner', instructions: 'Acuéstate boca arriba con las rodillas dobladas. Levanta los hombros del suelo.', sets: 3, reps: 20, calories: 25 },
            { id: 24, name: 'Elevación de piernas', muscleGroup: 'core', difficulty: 'intermediate', instructions: 'Acuéstate boca arriba. Levanta las piernas rectas hasta formar 90 grados con el suelo.', sets: 3, reps: 15, calories: 30 },
            { id: 25, name: 'Russian twists', muscleGroup: 'core', difficulty: 'intermediate', instructions: 'Siéntate con las piernas elevadas. Gira el torso de lado a lado.', sets: 3, reps: 20, calories: 35 },
            { id: 26, name: 'Mountain climbers', muscleGroup: 'core', difficulty: 'beginner', instructions: 'En posición de plancha, lleva las rodillas hacia el pecho alternándolas rápidamente.', sets: 3, reps: 20, calories: 40 }
        ];

        this.displayExercises(this.exercises);
    }

    displayExercises(exercises) {
        const container = document.getElementById('exercisesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        exercises.forEach(exercise => {
            const card = this.safeCreateElement('div', '', {
                className: 'exercise-card'
            });
            
            const header = this.safeCreateElement('div', '', {
                className: 'flex justify-between items-start mb-3'
            });
            
            const title = this.safeCreateElement('h4', exercise.name, {
                className: 'font-bold text-lg'
            });
            
            const muscleGroup = this.safeCreateElement('span', this.getMuscleGroupName(exercise.muscleGroup), {
                className: `muscle-group muscle-${exercise.muscleGroup}`
            });
            
            header.appendChild(title);
            header.appendChild(muscleGroup);
            
            const details = this.safeCreateElement('div', '', {
                className: 'text-sm text-gray-600 mb-3'
            });
            
            details.innerHTML = `
                <p><i class="fas fa-layer-group mr-1"></i> ${exercise.sets} series × ${exercise.reps}</p>
                <p><i class="fas fa-fire mr-1"></i> ${exercise.calories} calorías</p>
                <p><i class="fas fa-signal mr-1"></i> ${this.getDifficultyName(exercise.difficulty)}</p>
            `;
            
            const button = this.safeCreateElement('button', 'Ver Detalles', {
                className: 'w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition',
                'data-exercise-id': exercise.id
            });
            
            button.addEventListener('click', () => this.showExerciseDetails(exercise.id));
            
            card.appendChild(header);
            card.appendChild(details);
            card.appendChild(button);
            container.appendChild(card);
        });
    }

    // Workout Routines
    loadRoutines() {
        this.routines = [
            {
                id: 1,
                name: 'Rutina Full Body Principiante',
                level: 'beginner',
                duration: '3 días por semana',
                description: 'Perfecta para principiantes que quieren empezar en el gimnasio. Trabaja todos los grupos musculares principales.',
                exercises: [
                    { exerciseId: 4, sets: 3, reps: 12 }, // Flexiones
                    { exerciseId: 9, sets: 3, reps: 15 }, // Sentadillas
                    { exerciseId: 6, sets: 3, reps: 12 }, // Remo con barra
                    { exerciseId: 14, sets: 3, reps: 12 }, // Press militar
                    { exerciseId: 18, sets: 3, reps: 12 }, // Curl de bíceps
                    { exerciseId: 22, sets: 3, reps: '45 seg' } // Plancha
                ]
            },
            {
                id: 2,
                name: 'Rutina Empuje/Tirón/Pierna',
                level: 'intermediate',
                duration: '4 días por semana',
                description: 'División clásica para nivel intermedio. Mayor volumen y frecuencia por grupo muscular.',
                exercises: [
                    // Día 1 - Empuje (Pecho, Hombros, Tríceps)
                    { exerciseId: 1, sets: 4, reps: 12, day: 1 },
                    { exerciseId: 2, sets: 3, reps: 10, day: 1 },
                    { exerciseId: 14, sets: 4, reps: 12, day: 1 },
                    { exerciseId: 15, sets: 3, reps: 15, day: 1 },
                    { exerciseId: 20, sets: 3, reps: 12, day: 1 },
                    // Día 2 - Tirón (Espalda, Bíceps)
                    { exerciseId: 5, sets: 3, reps: 8, day: 2 },
                    { exerciseId: 6, sets: 4, reps: 12, day: 2 },
                    { exerciseId: 7, sets: 3, reps: 10, day: 2 },
                    { exerciseId: 18, sets: 3, reps: 12, day: 2 },
                    // Día 3 - Pierna
                    { exerciseId: 9, sets: 4, reps: 15, day: 3 },
                    { exerciseId: 10, sets: 3, reps: 10, day: 3 },
                    { exerciseId: 11, sets: 3, reps: 12, day: 3 },
                    { exerciseId: 13, sets: 4, reps: 20, day: 3 }
                ]
            },
            {
                id: 3,
                name: 'Rutina Upper/Lower Split',
                level: 'intermediate',
                duration: '4 días por semana',
                description: 'División superior/inferior para mayor frecuencia y recuperación.',
                exercises: [
                    // Upper Body
                    { exerciseId: 1, sets: 4, reps: 10, day: 1 },
                    { exerciseId: 5, sets: 3, reps: 8, day: 1 },
                    { exerciseId: 14, sets: 3, reps: 12, day: 1 },
                    { exerciseId: 6, sets: 4, reps: 10, day: 1 },
                    { exerciseId: 18, sets: 3, reps: 12, day: 1 },
                    // Lower Body
                    { exerciseId: 9, sets: 4, reps: 12, day: 2 },
                    { exerciseId: 10, sets: 3, reps: 8, day: 2 },
                    { exerciseId: 12, sets: 4, reps: 15, day: 2 },
                    { exerciseId: 13, sets: 4, reps: 20, day: 2 },
                    { exerciseId: 22, sets: 3, reps: '60 seg', day: 2 }
                ]
            }
        ];

        this.displayRoutines(this.routines);
    }

    displayRoutines(routines) {
        const container = document.getElementById('routinesList');
        if (!container) return;
        
        container.innerHTML = '';

        routines.forEach(routine => {
            const card = this.safeCreateElement('div', '', {
                className: 'routine-card'
            });
            
            const header = this.safeCreateElement('div', '', {
                className: 'routine-header'
            });
            
            const title = this.safeCreateElement('h3', routine.name, {
                className: 'text-xl font-bold mb-2'
            });
            
            const meta = this.safeCreateElement('div', '', {
                className: 'flex items-center space-x-4 text-sm'
            });
            
            meta.innerHTML = `
                <span><i class="fas fa-clock mr-1"></i> ${routine.duration}</span>
                <span><i class="fas fa-signal mr-1"></i> ${this.getDifficultyName(routine.level)}</span>
            `;
            
            header.appendChild(title);
            header.appendChild(meta);
            
            const body = this.safeCreateElement('div', '', {
                className: 'routine-body'
            });
            
            const description = this.safeCreateElement('p', routine.description, {
                className: 'text-gray-600 mb-4'
            });
            
            const footer = this.safeCreateElement('div', '', {
                className: 'flex justify-between items-center'
            });
            
            const exerciseCount = this.safeCreateElement('span', '', {
                className: 'text-sm text-gray-500'
            });
            
            exerciseCount.innerHTML = `<i class="fas fa-dumbbell mr-1"></i> ${routine.exercises.length} ejercicios`;
            
            const button = this.safeCreateElement('button', 'Empezar Rutina', {
                className: 'bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition',
                'data-routine-id': routine.id
            });
            
            button.addEventListener('click', () => this.startWorkout(routine.id));
            
            footer.appendChild(exerciseCount);
            footer.appendChild(button);
            
            body.appendChild(description);
            body.appendChild(footer);
            
            card.appendChild(header);
            card.appendChild(body);
            container.appendChild(card);
        });
    }

    // Workout Execution
    startWorkout(routineId) {
        this.currentRoutine = this.routines.find(r => r.id === routineId);
        this.currentExerciseIndex = 0;
        this.showWorkoutModal();
        this.displayCurrentExercise();
    }

    displayCurrentExercise() {
        if (!this.currentRoutine || this.currentExerciseIndex >= this.currentRoutine.exercises.length) {
            this.completeWorkout();
            return;
        }

        const currentExerciseData = this.currentRoutine.exercises[this.currentExerciseIndex];
        const exercise = this.exercises.find(e => e.id === currentExerciseData.exerciseId);
        
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <div class="text-center">
                <div class="mb-6">
                    <h4 class="text-2xl font-bold mb-2">${exercise.name}</h4>
                    <span class="muscle-group muscle-${exercise.muscleGroup}">${this.getMuscleGroupName(exercise.muscleGroup)}</span>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-6 mb-6">
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div class="text-center">
                            <p class="text-sm text-gray-500">Serie</p>
                            <p class="text-2xl font-bold">${this.currentExerciseIndex + 1}/${this.currentRoutine.exercises.length}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-sm text-gray-500">Series</p>
                            <p class="text-2xl font-bold">${currentExerciseData.sets}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-sm text-gray-500">Repeticiones</p>
                            <p class="text-2xl font-bold">${currentExerciseData.reps}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-blue-50 rounded-lg p-6 mb-6">
                    <h5 class="font-bold mb-3">Instrucciones:</h5>
                    <p class="text-gray-700">${exercise.instructions}</p>
                </div>

                <div class="timer-display mb-6" id="restTimer">
                    00:00
                </div>

                <div class="timer-controls">
                    <button onclick="app.startRestTimer()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition mr-2">
                        <i class="fas fa-clock mr-2"></i>Descansar
                    </button>
                    <button onclick="app.nextExercise()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
                        Siguiente Ejercicio <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        `;
    }

    startRestTimer() {
        let seconds = 60; // 1 minute rest
        const timerDisplay = document.getElementById('restTimer');
        
        if (this.restTimer) {
            clearInterval(this.restTimer);
        }

        this.restTimer = setInterval(() => {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            if (seconds <= 0) {
                clearInterval(this.restTimer);
                timerDisplay.textContent = '¡Listo!';
                // Play a sound or notification here
            }
            seconds--;
        }, 1000);
    }

    nextExercise() {
        if (this.restTimer) {
            clearInterval(this.restTimer);
        }
        this.currentExerciseIndex++;
        this.displayCurrentExercise();
    }

    completeWorkout() {
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <div class="text-center">
                <div class="mb-6">
                    <svg class="success-checkmark mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="success-checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold mb-4">¡Entrenamiento Completado!</h3>
                <p class="text-gray-600 mb-6">Felicidades por completar tu rutina</p>
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-500">Ejercicios</p>
                            <p class="text-xl font-bold">${this.currentRoutine.exercises.length}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Calorías estimadas</p>
                            <p class="text-xl font-bold">${this.calculateWorkoutCalories()}</p>
                        </div>
                    </div>
                </div>
                <button onclick="app.closeWorkoutModal()" class="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition">
                    Cerrar
                </button>
            </div>
        `;

        this.saveWorkoutToHistory();
    }

    calculateWorkoutCalories() {
        if (!this.currentRoutine) return 0;
        
        let totalCalories = 0;
        this.currentRoutine.exercises.forEach(exerciseData => {
            const exercise = this.exercises.find(e => e.id === exerciseData.exerciseId);
            if (exercise) {
                totalCalories += exercise.calories * exerciseData.sets;
            }
        });
        
        return totalCalories;
    }

    saveWorkoutToHistory() {
        const workout = {
            date: new Date().toISOString(),
            routineName: this.currentRoutine.name,
            exercises: this.currentRoutine.exercises.length,
            calories: this.calculateWorkoutCalories(),
            duration: 45 // estimated duration in minutes
        };

        this.userData.workoutHistory.unshift(workout);
        this.userData.stats.totalWorkouts++;
        this.userData.stats.totalCalories += workout.calories;
        
        // Update streak
        this.updateStreak();
        
        this.saveUserData();
        this.updateDashboard();
    }

    updateStreak() {
        const today = new Date().toDateString();
        const lastWorkout = this.userData.stats.lastWorkoutDate;
        
        if (lastWorkout) {
            const lastDate = new Date(lastWorkout);
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                this.userData.stats.streakDays++;
            } else if (diffDays > 1) {
                this.userData.stats.streakDays = 1;
            }
        } else {
            this.userData.stats.streakDays = 1;
        }
        
        this.userData.stats.lastWorkoutDate = today;
    }

    // Dashboard Updates
    updateDashboard() {
        // Update weekly stats
        const weekStats = this.getWeeklyStats();
        document.getElementById('weeklyCalories').textContent = weekStats.calories;
        document.getElementById('weeklyWorkouts').textContent = weekStats.workouts;
        document.getElementById('weeklyTime').textContent = weekStats.time + ' min';
        document.getElementById('weeklyCaloriesDetail').textContent = weekStats.calories;
        document.getElementById('streakDays').textContent = this.userData.stats.streakDays;

        // Update workout history
        this.updateWorkoutHistory();
    }

    getWeeklyStats() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weekWorkouts = this.userData.workoutHistory.filter(workout => 
            new Date(workout.date) >= oneWeekAgo
        );

        return {
            workouts: weekWorkouts.length,
            calories: weekWorkouts.reduce((sum, w) => sum + w.calories, 0),
            time: weekWorkouts.reduce((sum, w) => sum + w.duration, 0)
        };
    }

    updateWorkoutHistory() {
        const historyContainer = document.getElementById('workoutHistory');
        const recentWorkouts = this.userData.workoutHistory.slice(0, 5);
        
        if (recentWorkouts.length === 0) {
            historyContainer.innerHTML = '<p class="text-gray-500">No hay entrenamientos registrados</p>';
            return;
        }

        historyContainer.innerHTML = recentWorkouts.map(workout => {
            const date = new Date(workout.date);
            const dateStr = date.toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short' 
            });
            
            return `
                <div class="flex justify-between items-center py-2 border-b">
                    <span class="text-sm">${workout.routineName}</span>
                    <span class="text-xs text-gray-500">${dateStr}</span>
                </div>
            `;
        }).join('');
    }

    // Modal Management
    showWorkoutModal() {
        document.getElementById('workoutModal').classList.remove('hidden');
        document.getElementById('modalTitle').textContent = this.currentRoutine.name;
    }

    closeWorkoutModal() {
        document.getElementById('workoutModal').classList.add('hidden');
        if (this.restTimer) {
            clearInterval(this.restTimer);
        }
        this.currentRoutine = null;
        this.currentExerciseIndex = 0;
    }

    showExerciseDetails(exerciseId) {
        const exercise = this.exercises.find(e => e.id === exerciseId);
        if (!exercise) return;

        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <div class="space-y-6">
                <div>
                    <h4 class="text-2xl font-bold mb-2">${exercise.name}</h4>
                    <span class="muscle-group muscle-${exercise.muscleGroup}">${this.getMuscleGroupName(exercise.muscleGroup)}</span>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-sm text-gray-500 mb-1">Series</p>
                        <p class="text-xl font-bold">${exercise.sets}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-sm text-gray-500 mb-1">Repeticiones</p>
                        <p class="text-xl font-bold">${exercise.reps}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-sm text-gray-500 mb-1">Calorías</p>
                        <p class="text-xl font-bold">${exercise.calories}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-sm text-gray-500 mb-1">Dificultad</p>
                        <p class="text-xl font-bold">${this.getDifficultyName(exercise.difficulty)}</p>
                    </div>
                </div>

                <div class="bg-blue-50 rounded-lg p-6">
                    <h5 class="font-bold mb-3">Instrucciones detalladas:</h5>
                    <p class="text-gray-700 leading-relaxed">${exercise.instructions}</p>
                </div>

                <div class="bg-yellow-50 rounded-lg p-4">
                    <h5 class="font-bold mb-2 text-yellow-800">
                        <i class="fas fa-exclamation-triangle mr-2"></i>Consejos de seguridad:
                    </h5>
                    <ul class="text-sm text-yellow-700 space-y-1">
                        <li>• Calienta siempre antes de empezar</li>
                        <li>• Mantén la técnica correcta</li>
                        <li>• No uses peso que no puedas controlar</li>
                        <li>• Escucha a tu cuerpo y descansa cuando sea necesario</li>
                    </ul>
                </div>

                <div class="flex justify-end">
                    <button onclick="app.closeWorkoutModal()" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.getElementById('modalTitle').textContent = exercise.name;
        document.getElementById('workoutModal').classList.remove('hidden');
    }

    // Filter Functions
    filterRoutines(level) {
        const filtered = level === 'all' ? this.routines : this.routines.filter(r => r.level === level);
        this.displayRoutines(filtered);
        
        // Update button styles
        document.querySelectorAll('.routine-filter').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        event.target.classList.remove('bg-gray-200', 'text-gray-700');
        event.target.classList.add('bg-blue-600', 'text-white');
    }

    filterExercises(muscleGroup) {
        const filtered = muscleGroup === 'all' ? this.exercises : this.exercises.filter(e => e.muscleGroup === muscleGroup);
        this.displayExercises(filtered);
        
        // Update button styles
        document.querySelectorAll('.exercise-filter').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        event.target.classList.remove('bg-gray-200', 'text-gray-700');
        event.target.classList.add('bg-blue-600', 'text-white');
    }

    searchExercises(query) {
        if (!query) {
            this.displayExercises(this.exercises);
            return;
        }

        const filtered = this.exercises.filter(exercise => 
            exercise.name.toLowerCase().includes(query.toLowerCase()) ||
            this.getMuscleGroupName(exercise.muscleGroup).toLowerCase().includes(query.toLowerCase())
        );
        
        this.displayExercises(filtered);
    }

    // Utility Functions
    getMuscleGroupName(group) {
        const names = {
            chest: 'Pecho',
            back: 'Espalda',
            legs: 'Piernas',
            shoulders: 'Hombros',
            arms: 'Brazos',
            core: 'Abdomen'
        };
        return names[group] || group;
    }

    getDifficultyName(difficulty) {
        const names = {
            beginner: 'Principiante',
            intermediate: 'Intermedio',
            advanced: 'Avanzado'
        };
        return names[difficulty] || difficulty;
    }
}

// Initialize the app
const app = new GymRoutineApp();

// Global functions for onclick handlers
function showSection(section) {
    app.showSection(section);
}

function filterRoutines(level) {
    app.filterRoutines(level);
}

function filterExercises(muscleGroup) {
    app.filterExercises(muscleGroup);
}

function closeWorkoutModal() {
    app.closeWorkoutModal();
}
