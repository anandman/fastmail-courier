/**
 * CalDAV Integration Tests
 *
 * Tests for CalDAV calendar and task functionality.
 * Requires TEST_CALDAV_USERNAME and TEST_CALDAV_PASSWORD in .env.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testConfig } from './setup.js';
import { FastmailCalDAVClient } from '../src/caldav/client.js';
import type { Task, Calendar } from '../src/caldav/types.js';

describe('CalDAV Integration', () => {
    let client: FastmailCalDAVClient;
    let testCalendarUrl: string;
    let createdTaskUrl: string | null = null;

    beforeAll(async () => {
        if (!testConfig.isCalDAVConfigured) {
            console.warn('⚠️  Skipping CalDAV tests - TEST_CALDAV_USERNAME and TEST_CALDAV_PASSWORD not configured');
            return;
        }

        client = new FastmailCalDAVClient({
            username: testConfig.caldavUsername!,
            password: testConfig.caldavPassword!,
        });

        await client.connect();
    });

    afterAll(async () => {
        // Clean up test task if it was created
        if (createdTaskUrl && client) {
            try {
                await client.deleteTask(createdTaskUrl);
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    describe('Connection', () => {
        it('connects to Fastmail CalDAV server', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            // Connection already established in beforeAll
            expect(client).toBeDefined();
        });
    });

    describe('Calendars', () => {
        it('lists all calendars', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            const calendars = await client.getCalendars();

            expect(calendars).toBeDefined();
            expect(Array.isArray(calendars)).toBe(true);
            expect(calendars.length).toBeGreaterThan(0);

            // Each calendar should have required properties
            const calendar = calendars[0];
            expect(calendar.url).toBeDefined();
            expect(calendar.displayName).toBeDefined();
            expect(Array.isArray(calendar.components)).toBe(true);
        });

        it('lists task-capable calendars', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            const taskCalendars = await client.getTaskCalendars();

            expect(Array.isArray(taskCalendars)).toBe(true);

            // Store first task calendar URL for later tests
            if (taskCalendars.length > 0) {
                testCalendarUrl = taskCalendars[0].url;
                expect(taskCalendars[0].supportsTasks).toBe(true);
            }
        });
    });

    describe('Tasks', () => {
        it('lists tasks', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            const tasks = await client.getTasks({ includeCompleted: true });

            expect(Array.isArray(tasks)).toBe(true);

            // Tasks should have required properties if any exist
            if (tasks.length > 0) {
                const task = tasks[0];
                expect(task.url).toBeDefined();
                expect(task.uid).toBeDefined();
                expect(task.summary).toBeDefined();
                expect(task.status).toBeDefined();
            }
        });

        it('creates a new task', async () => {
            if (!testConfig.isCalDAVConfigured || !testCalendarUrl) {
                return;
            }

            const taskData = {
                summary: `Test Task ${Date.now()}`,
                description: 'Created by automated test',
                due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
                priority: 5,
                categories: ['test', 'automated'],
            };

            const task = await client.createTask(testCalendarUrl, taskData);
            createdTaskUrl = task.url;

            expect(task).toBeDefined();
            expect(task.url).toBeDefined();
            expect(task.uid).toBeDefined();
            expect(task.summary).toBe(taskData.summary);
            expect(task.status).toBe('needs-action');
        });

        it('retrieves a task by URL', async () => {
            if (!testConfig.isCalDAVConfigured || !createdTaskUrl) {
                return;
            }

            const task = await client.getTask(createdTaskUrl);

            expect(task).not.toBeNull();
            expect(task!.url).toBe(createdTaskUrl);
            expect(task!.description).toBe('Created by automated test');
        });

        it('updates a task', async () => {
            if (!testConfig.isCalDAVConfigured || !createdTaskUrl) {
                return;
            }

            const updatedSummary = `Updated Test Task ${Date.now()}`;
            const task = await client.updateTask(createdTaskUrl, {
                summary: updatedSummary,
                priority: 1,
            });

            expect(task.summary).toBe(updatedSummary);
        });

        it('marks a task as complete', async () => {
            if (!testConfig.isCalDAVConfigured || !createdTaskUrl) {
                return;
            }

            const task = await client.completeTask(createdTaskUrl);

            expect(task.status).toBe('completed');
            expect(task.percentComplete).toBe(100);
        });

        it('deletes a task', async () => {
            if (!testConfig.isCalDAVConfigured || !createdTaskUrl) {
                return;
            }

            await client.deleteTask(createdTaskUrl);

            // Verify deletion
            const task = await client.getTask(createdTaskUrl);
            expect(task).toBeNull();

            createdTaskUrl = null; // Mark as deleted so afterAll doesn't try again
        });
    });

    describe('Task Filtering', () => {
        it('filters tasks by status', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            const incompleteTasks = await client.getTasks({
                status: ['needs-action', 'in-process'],
                includeCompleted: false,
            });

            // All returned tasks should be incomplete
            for (const task of incompleteTasks) {
                expect(['needs-action', 'in-process']).toContain(task.status);
            }
        });

        it('filters completed tasks', async () => {
            if (!testConfig.isCalDAVConfigured) {
                return;
            }

            // Without includeCompleted, should not return completed tasks
            const activeTasks = await client.getTasks({
                includeCompleted: false,
            });

            for (const task of activeTasks) {
                expect(task.status).not.toBe('completed');
            }
        });
    });
});
