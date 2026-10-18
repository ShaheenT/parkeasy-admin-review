Feature: Admin authentication
  Scenario: Admin signs in and logs out
    Given I am on the login page
    When I sign in as "admin@parkeasy.co.za" with password "admin123"
    Then I should see the "Dashboard" page
    When I log out
    Then I should see the login page

  Scenario: Wrong password is rejected
    Given I am on the login page
    When I sign in as "admin@parkeasy.co.za" with password "wrong"
    Then I should see the error "Email or password is incorrect."
