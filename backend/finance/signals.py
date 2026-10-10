"""Remove replay copies when their account or guest ownership ends."""

from django.contrib.auth import get_user_model
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import GuestProfile, IdempotencyRecord


@receiver(pre_delete, sender=get_user_model())
def remove_user_replays(sender, instance, using, **kwargs):
    IdempotencyRecord.objects.using(using).filter(owner_key=f"user:{instance.pk}").delete()


@receiver(pre_delete, sender=GuestProfile)
def remove_profile_replays(sender, instance, using, **kwargs):
    IdempotencyRecord.objects.using(using).filter(owner_key=f"profile:{instance.public_id}").delete()
