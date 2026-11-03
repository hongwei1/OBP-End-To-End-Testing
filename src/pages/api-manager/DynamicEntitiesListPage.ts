import { type Page } from '@playwright/test';
import { BasePage } from '../BasePage.js';
import { env } from '../../config/env.js';

export class DynamicEntitiesListPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.navigateTo(`${env.API_MANAGER_BASE_URL}/dynamic-entities/system`);
  }

  /**
   * Resolve a dynamic entity's id from its name link on the list page. OBP caches the entity list for
   * dynamicEntity.cache.ttl.seconds (default 30), so a new entity can be missing at first: reload the list until it
   * appears, for up to 45 seconds.
   */
  async entityIdForName(entityName: string): Promise<string> {
    const link = this.page.locator('a[href^="/dynamic-entities/system/"]', {
      hasText: entityName,
    });
    const deadline = Date.now() + 45_000;
    while (!(await link.first().isVisible()) && Date.now() < deadline) {
      await this.page.waitForTimeout(5_000);
      await this.goto();
    }
    const href = await link.first().getAttribute('href');
    if (!href) {
      throw new Error(`No entity link found for "${entityName}"`);
    }
    // API Manager links an entity as /dynamic-entities/system/{id}?bank_id=SYS since its November 2026 build;
    // the id is the path's last segment, without the query.
    const id = new URL(href, 'http://api-manager.invalid').pathname.split('/').pop();
    if (!id) {
      throw new Error(`Could not extract entity id from href "${href}"`);
    }
    return id;
  }
}
