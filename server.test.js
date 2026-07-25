const request = require('supertest');
const app = require('./server');
const dbHelper = require('./database');

describe('Aethera Full-Stack API Suite', () => {
    beforeEach((done) => {
        dbHelper.db.run("UPDATE caregivers SET status = 'AVAILABLE'", [], () => {
            done();
        });
    });

    // Close the SQLite database connection after all tests run to prevent Jest from hanging
    afterAll((done) => {
        dbHelper.db.close(() => {
            console.log('Database connection closed.');
            done();
        });
    });

    describe('GET /api/telemetry', () => {
        it('should return 200 OK and valid system properties', async () => {
            const res = await request(app)
                .get('/api/telemetry')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body).toHaveProperty('cpu');
            expect(res.body).toHaveProperty('memory');
            expect(res.body).toHaveProperty('entropy');
            expect(res.body).toHaveProperty('gravityCompensator');
            expect(res.body).toHaveProperty('systemUptime');
            expect(typeof res.body.cpu).toBe('number');
            expect(typeof res.body.memory).toBe('number');
        });
    });

    describe('POST /api/register', () => {
        const testEmail = `test_${Math.floor(Math.random() * 10000)}@evaluator.com`;

        it('should successfully register a valid email and return an access token', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({ email: testEmail })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('key');
            expect(res.body.email).toBe(testEmail);
            expect(res.body.key.startsWith('AG-')).toBe(true);
        });

        it('should return 400 Bad Request for an invalid email format', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({ email: 'bad-email-address' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('format');
        });

        it('should return 400 Bad Request for an oversized email', async () => {
            const longEmail = 'a'.repeat(120) + '@test.com';
            const res = await request(app)
                .post('/api/register')
                .send({ email: longEmail })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('size');
        });
    });

    describe('POST /api/generate', () => {
        it('should return a valid generated response for normal input prompt', async () => {
            const res = await request(app)
                .post('/api/generate')
                .send({
                    prompt: 'Cope with active cravings using cognitive behavioral therapy (CBT) focus',
                    engine: 'Aethera LLM v4',
                    temp: '0.7'
                })
                .expect(200);

            expect(res.body).toHaveProperty('response');
            expect(res.body.response).toContain('[AETHERA CLINICAL PROTOCOL // COPING CHECKLIST]');
        });

        it('should return 400 Bad Request if prompt is missing', async () => {
            const res = await request(app)
                .post('/api/generate')
                .send({ engine: 'Aethera LLM v4' })
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });

        it('should return 400 Bad Request if prompt exceeds length bounds', async () => {
            const giantPrompt = 'X'.repeat(1300);
            const res = await request(app)
                .post('/api/generate')
                .send({ prompt: giantPrompt })
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });

        it('should trigger deterministic safety intercept when safetyMode is enabled', async () => {
            const res = await request(app)
                .post('/api/generate')
                .send({
                    prompt: 'Explain the database query',
                    engine: 'Aethera LLM v4',
                    temp: '0.7',
                    safetyMode: true
                })
                .expect(200);

            expect(res.body).toHaveProperty('response');
            expect(res.body.response).toContain('DETERMINISTIC SAFETY PIPELINE OUTCOME');
        });

        it('should automatically intercept and route sensitive keywords deterministically', async () => {
            const res = await request(app)
                .post('/api/generate')
                .send({
                    prompt: 'I think someone is having an overdose',
                    engine: 'Aethera LLM v4',
                    temp: '0.7',
                    safetyMode: false
                })
                .expect(200);

            expect(res.body).toHaveProperty('response');
            expect(res.body.response).toContain('[DETERMINISTIC CRISIS ROUTER - OVERDOSE DETECTED]');
        });

        it('should route to persuasive engine template when Persuader Voice Core is selected', async () => {
            const res = await request(app)
                .post('/api/generate')
                .send({
                    prompt: 'Cope with active cravings',
                    engine: 'Persuader Voice Core',
                    temp: '0.7'
                })
                .expect(200);

            expect(res.body).toHaveProperty('response');
            expect(res.body.response).toContain('[AETHERA PERSUASIVE RECOVERY CORE]');
            expect(res.body.response).toContain('Hook:');
            expect(res.body.response).toContain('Evidence:');
            expect(res.body.response).toContain('Benefit:');
        });
    });

    describe('POST /api/dispatch-alert', () => {
        it('should calculate proximity, find the closest available caregiver, and dispatch successfully', async () => {
            const res = await request(app)
                .post('/api/dispatch-alert')
                .send({
                    patientLat: 37.7749,
                    patientLon: -122.4194
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('caregiver');
            expect(res.body.caregiver.name).toBe('Dr. Sarah Chen'); // Closest available caregiver
            expect(res.body).toHaveProperty('distance');
            expect(res.body.distance).toBeLessThan(1.5);
            expect(res.body).toHaveProperty('transitTime');
        });

        it('should return 400 Bad Request for invalid coordinate formatting', async () => {
            const res = await request(app)
                .post('/api/dispatch-alert')
                .send({
                    patientLat: 'invalid_lat',
                    patientLon: 'invalid_lon'
                })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('coordinates');
        });
    });
});
