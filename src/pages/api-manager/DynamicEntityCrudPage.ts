import { type Page } from '@playwright/test';
import { BasePage } from '../BasePage.js';
import { env } from '../../config/env.js';

/**
 * The record CRUD page for a system dynamic entity
 * (/dynamic-entities/system/{id}/crud).
 *
 * Create/edit modal inputs have ids `create-{fieldName}` / `edit-{fieldName}`;
 * inline validation errors have data-testids `create-error-{fieldName}` /
 * `edit-error-{fieldName}`.
 */
export class DynamicEntityCrudPage extends BasePage {
  private openCreateButton = this.page.locator('[data-testid="open-create-record"]');
  private submitCreateButton = this.page.locator('[data-testid="submit-create-record"]');
  private submitEditButton = this.page.locator('[data-testid="submit-edit-record"]');

  constructor(page: Page) {
    super(page);
  }

  async gotoFor(entityId: string) {
    const url = `${env.API_MANAGER_BASE_URL}/dynamic-entities/system/${entityId}/crud`;
    await this.navigateTo(url);
    // Wait for SvelteKit hydration so button clicks reach the JS handlers.
    await this.page.waitForLoadState('networkidle');
    // OBP serves a new entity's record endpoints only once its cached definitions catch up (they answer 404 until
    // then, for up to dynamicEntity.cache.ttl.seconds, 30 by default); reload until the records load, up to 45 s.
    const unavailable = this.page.getByRole('heading', { name: 'Records Unavailable' });
    const deadline = Date.now() + 45_000;
    while ((await unavailable.isVisible()) && Date.now() < deadline) {
      await this.page.waitForTimeout(5_000);
      await this.navigateTo(url);
      await this.page.waitForLoadState('networkidle');
    }
  }

  async openCreateModal() {
    await this.openCreateButton.click();
    await this.submitCreateButton.waitFor({ state: 'visible' });
  }

  createFieldInput(fieldName: string) {
    return this.page.locator(`#create-${fieldName}`);
  }

  createFieldError(fieldName: string) {
    return this.page.locator(`[data-testid="create-error-${fieldName}"]`);
  }

  async submitCreate() {
    await this.submitCreateButton.click();
  }

  recordRow(index: number) {
    return this.page.locator(`[data-testid="record-row-${index}"]`);
  }

  async openEditModalForRow(index: number) {
    await this.page.locator(`[data-testid="edit-record-${index}"]`).click();
    await this.submitEditButton.waitFor({ state: 'visible' });
  }

  editFieldInput(fieldName: string) {
    return this.page.locator(`#edit-${fieldName}`);
  }

  editFieldError(fieldName: string) {
    return this.page.locator(`[data-testid="edit-error-${fieldName}"]`);
  }

  async submitEdit() {
    await this.submitEditButton.click();
  }

  /**
   * Delete a record row. Triggers a native confirm() and a result alert() —
   * register a DialogWatcher before calling this.
   */
  async deleteRecord(index: number) {
    await this.page.locator(`[data-testid="delete-record-${index}"]`).click();
  }
}
