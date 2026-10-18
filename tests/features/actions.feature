Feature: Row actions and filters
  Background:
    Given I am signed in as an admin

  Scenario: Approve a pending scout lead
    When I open "Scout Leads" from the sidebar
    And I click "Approve" on the row containing "12 Kloof St"
    Then the row containing "12 Kloof St" should show status "approved"

  Scenario: Filter payouts by status
    When I open "Payouts" from the sidebar
    And I filter by "queued"
    Then every visible row should have status "queued"

  Scenario: Release a queued payout
    When I open "Payouts" from the sidebar
    And I click "Release" on the row containing "PO-21"
    Then the row containing "PO-21" should show status "paid"

  Scenario: Flag a KYC profile as high risk
    When I open "KYC / Risk" from the sidebar
    And I click "Flag" on the row containing "Naledi Mokoena"
    Then the row containing "Naledi Mokoena" should show status "flagged"
