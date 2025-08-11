using JewelrySite.BL;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace JewelrySite.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	public class JewelryItemController : ControllerBase
	{
		[HttpGet]
		public ActionResult<List<JewelryItem>> GetJewerlyItems()
		{
			return Ok(JewelryItem.GetJewelryItems());
		}

		[HttpGet("{id}")] 
		public ActionResult<JewelryItem> GetJewerlyItem(int id) 
		{
			JewelryItem j = JewelryItem.GetJewelryItemById(id);
			if (j == null) {return NotFound();}
			return Ok(j);
		}

		[HttpPost]
		public ActionResult<JewelryItem> AddJewerlyItem(JewelryItem j ) 
		{ 
			//if j is null BadReq otherwise Ok
			return JewelryItem.AddJewelryItem(j) != null ? CreatedAtAction(nameof(AddJewerlyItem),j) : BadRequest();
		}

		[HttpPut]
		public ActionResult UpdateJewerlyItem(int id, JewelryItem updatedJewerly)
		{
			if (JewelryItem.UpdateJewelryItem(id, updatedJewerly) != null) { return NoContent();}
			return BadRequest();
		}

		[HttpDelete]
		public ActionResult DeleteJewerlyItem(int id)
		{
			if (JewelryItem.DeleteJewelryItem(id)) {return NoContent();}
			return BadRequest();
		}
	}
}
