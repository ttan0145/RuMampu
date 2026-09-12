from django.db import migrations, models


def mark_existing_users_with_financial_data(apps, schema_editor):
    """Preserve the experience for existing users who already used RuMampu.

    The explicit flag is authoritative from this migration onward. For old
    accounts, infer completion only when there is evidence of real user data;
    default/bootstrap rows alone do not count.
    """
    UserAppState = apps.get_model("finance", "UserAppState")
    GuestProfile = apps.get_model("finance", "GuestProfile")
    IncomeEntry = apps.get_model("finance", "IncomeEntry")
    WorkCostEntry = apps.get_model("finance", "WorkCostEntry")
    CommitmentItem = apps.get_model("finance", "CommitmentItem")
    ExpenseEntry = apps.get_model("finance", "ExpenseEntry")

    for state in UserAppState.objects.select_related("user").all():
        profile = GuestProfile.objects.filter(user_id=state.user_id).first()
        if profile is None:
            continue

        has_financial_data = (
            IncomeEntry.objects.filter(profile_id=profile.id).exists()
            or WorkCostEntry.objects.filter(profile_id=profile.id).exists()
            or CommitmentItem.objects.filter(profile_id=profile.id, monthly_amount__gt=0).exists()
            or ExpenseEntry.objects.filter(profile_id=profile.id).exists()
        )
        has_account_state = (
            state.cash_on_hand != 0
            or bool(state.upfront_costs)
            or bool(state.docs_checked)
            or bool(state.bought_home)
            or bool(state.expense_limits)
            or bool(state.compare_payments)
        )
        if has_financial_data or has_account_state:
            state.onboarding_completed = True
            state.save(update_fields=["onboarding_completed"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("finance", "0011_guestprofile_user_userappstate")]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="onboarding_completed",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_users_with_financial_data, noop_reverse),
    ]
