from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies=[('housing','0002_housingscenario_profile'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[migrations.CreateModel(name='SavedHousingTest', fields=[
        ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
        ('monthly_payment',models.DecimalField(decimal_places=2,max_digits=12)),('short_month_count',models.PositiveIntegerField(default=0)),('tested_months',models.PositiveIntegerField(default=0)),('largest_gap',models.DecimalField(decimal_places=2,default=0,max_digits=12)),('income_shock_percent',models.DecimalField(decimal_places=2,default=0,max_digits=6)),('created_at',models.DateTimeField(auto_now_add=True)),
        ('scenario',models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.SET_NULL,related_name='saved_tests',to='housing.housingscenario')),
        ('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='saved_housing_tests',to=settings.AUTH_USER_MODEL)),
    ], options={'ordering':['-created_at','-id']})]
